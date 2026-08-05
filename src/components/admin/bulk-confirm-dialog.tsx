import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { previewBulkAction, executeBulkAction } from "@/lib/bulk-actions.functions";
import type { BulkPreview, ExecResult, PlanRow } from "@/lib/bulk-actions.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

type PreviewInput = Parameters<typeof previewBulkAction>[0]["data"];

const SAMPLE_LIMIT = 8;

export type BulkConfirmDialogProps = {
  /** null keeps the dialog closed. */
  request: PreviewInput | null;
  onClose: () => void;
  /** Called after an execution that changed at least one record. */
  onCommitted?: () => void;
};

/**
 * Two-step commit: preview a server-built plan, confirm it, then read the
 * per-record result report. Nothing is written before the plan is shown.
 */
export function BulkConfirmDialog({ request, onClose, onCommitted }: BulkConfirmDialogProps) {
  const qc = useQueryClient();
  const previewFn = useServerFn(previewBulkAction);
  const executeFn = useServerFn(executeBulkAction);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [report, setReport] = useState<ExecResult | null>(null);
  const [progress, setProgress] = useState(0);

  const open = request !== null;

  const previewQ = useMutation({
    mutationFn: (input: PreviewInput) => previewFn({ data: input }),
    onSuccess: (p: BulkPreview) => setPreview(p),
    onError: (e: Error) => {
      toast.error(e.message || "Couldn't build the preview");
      onClose();
    },
  });

  // Build the plan once per opened request.
  const [seen, setSeen] = useState<PreviewInput | null>(null);
  if (open && request !== seen) {
    setSeen(request);
    setPreview(null);
    setReport(null);
    setProgress(0);
    previewQ.mutate(request);
  }

  const exec = useMutation({
    mutationFn: async (onlyIds?: string[]) => {
      if (!preview) throw new Error("No preview to execute");
      const total = onlyIds?.length ?? preview.eligible;
      setProgress(0);
      const ticker = setInterval(
        () => setProgress((n) => (n < total ? n + 1 : n)),
        Math.max(80, Math.min(400, 3000 / Math.max(1, total))),
      );
      try {
        return await executeFn({
          data: { plan_id: preview.plan_id, ...(onlyIds ? { only_ids: onlyIds } : {}) },
        });
      } finally {
        clearInterval(ticker);
      }
    },
    onSuccess: async (r: ExecResult) => {
      setReport(r);
      if (r.failed > 0) {
        toast.error(`${r.succeeded} of ${r.attempted} changed · ${r.failed} failed`);
      } else {
        toast.success(`${r.succeeded} record${r.succeeded === 1 ? "" : "s"} changed`);
      }
      if (r.succeeded > 0) {
        await qc.invalidateQueries();
        onCommitted?.();
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eligibleRows = useMemo(
    () => (preview?.rows ?? []).filter((r) => r.eligible),
    [preview],
  );
  const skippedRows = useMemo(
    () => (preview?.rows ?? []).filter((r) => !r.eligible),
    [preview],
  );
  const changedFields = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of eligibleRows) {
      for (const c of r.changes) map.set(c.field, `${c.from} → ${c.to}`);
    }
    return Array.from(map.entries());
  }, [eligibleRows]);

  const failures = (report?.results ?? []).filter((r) => !r.ok);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setSeen(null);
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {report ? "Result" : preview ? preview.summary : "Building preview…"}
          </DialogTitle>
          <DialogDescription>
            {report
              ? `${report.succeeded} of ${report.attempted} record(s) changed.`
              : preview
                ? `${preview.eligible} of ${preview.selected} selected record(s) will change. ${preview.skipped} will be skipped.`
                : "Checking which records can change."}
          </DialogDescription>
        </DialogHeader>

        {previewQ.isPending ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking {" "}
            {countOf(request)} selected record(s)…
          </div>
        ) : report ? (
          <div className="space-y-3 text-sm">
            {failures.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {failures.length} record(s) failed
                </p>
                <ul className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
                  {failures.map((f) => (
                    <li key={f.id} className="flex justify-between gap-3">
                      <span className="truncate">{f.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{f.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-success">
                <Check className="h-4 w-4" /> Every record in the plan was updated.
              </p>
            )}
          </div>
        ) : preview ? (
          <div className="space-y-4 text-sm">
            {changedFields.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Fields that will change</p>
                <ul className="space-y-1">
                  {changedFields.map(([field, delta]) => (
                    <li key={field} className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-mono text-xs">{field}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{delta}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-1 font-medium">
                Records that will change ({eligibleRows.length})
              </p>
              {eligibleRows.length === 0 ? (
                <p className="text-muted-foreground">
                  Nothing in this selection can change right now.
                </p>
              ) : (
                <ul className="space-y-1">
                  {eligibleRows.slice(0, SAMPLE_LIMIT).map((r: PlanRow) => (
                    <li key={r.id} className="flex justify-between gap-3">
                      <span className="truncate">{r.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{r.context}</span>
                    </li>
                  ))}
                  {eligibleRows.length > SAMPLE_LIMIT && (
                    <li className="text-xs text-muted-foreground">
                      + {eligibleRows.length - SAMPLE_LIMIT} more
                    </li>
                  )}
                </ul>
              )}
            </div>

            {skippedRows.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Skipped ({skippedRows.length})</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto">
                  {skippedRows.map((r: PlanRow) => (
                    <li key={r.id} className="flex justify-between gap-3">
                      <span className="truncate text-muted-foreground">{r.label}</span>
                      <Badge variant="outline" className="shrink-0 text-xs font-normal">
                        {r.reason}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {exec.isPending && (
              <p className="flex items-center gap-2 text-muted-foreground" aria-live="polite">
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying {Math.min(progress, eligibleRows.length)} of {eligibleRows.length}…
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          {report ? (
            <>
              {failures.length > 0 && (
                <Button
                  variant="outline"
                  disabled={exec.isPending}
                  onClick={() => exec.mutate(failures.map((f) => f.id))}
                >
                  {exec.isPending ? "Retrying…" : `Retry ${failures.length} failure(s)`}
                </Button>
              )}
              <Button
                onClick={() => {
                  onClose();
                  setSeen(null);
                }}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  onClose();
                  setSeen(null);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!preview || preview.eligible === 0 || exec.isPending}
                onClick={() => exec.mutate(undefined)}
              >
                {exec.isPending
                  ? "Applying…"
                  : `Confirm ${preview?.eligible ?? 0} change${preview?.eligible === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function countOf(request: PreviewInput | null): number {
  if (!request) return 0;
  if (request.kind === "candidate_assign") return request.candidate_profile_ids.length;
  if (request.kind === "position_pause") return request.position_ids.length;
  return request.match_ids.length;
}
