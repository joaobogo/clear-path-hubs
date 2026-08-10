import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { previewBulkAction, executeBulkAction } from "@/lib/bulk-actions.functions";
import type { BulkPreview, ExecResult, ExecItemResult, PlanRow } from "@/lib/bulk-actions.types";
import type { BulkStage } from "@/lib/admin-bulk-constants";
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
import { toastError } from "@/lib/toast-error";

type PreviewInput =
  | { kind: "candidate_stage"; match_ids: string[]; to_stage: BulkStage }
  | { kind: "candidate_assign"; candidate_profile_ids: string[]; position_id: string }
  | { kind: "candidate_update_message"; match_ids: string[]; message: string }
  | { kind: "position_pause"; position_ids: string[] };
export type { PreviewInput };

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
  const [report, setReport] = useState<RunReport | null>(null);
  // Live batch progress, driven by the cursor the server returns — not a timer.
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  // Set when a batch call itself fails. Holds everything needed to resume.
  const [stalled, setStalled] = useState<Stall | null>(null);

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
    setProgress(null);
    setStalled(null);
    previewQ.mutate(request);
  }

  /**
   * Runs a plan in bounded batches, following the cursor the server hands back.
   * Each batch commits on its own, so a mid-run failure keeps everything before
   * it and leaves a resume point instead of an unknown partial state.
   */
  const exec = useMutation({
    mutationFn: async (start: RunStart): Promise<RunReport> => {
      if (!preview) throw new Error("No preview to execute");
      const collected: ExecItemResult[] = [...(start.priorResults ?? [])];
      let cursor: number | null = start.cursor ?? 0;
      let total = start.expectedTotal ?? preview.eligible;
      let processed = collected.length;
      setProgress({ processed, total });

      while (cursor !== null) {
        const from: number = cursor;
        let batch: ExecResult;
        try {
          batch = await executeFn({
            data: {
              plan_id: preview.plan_id,
              ...(start.onlyIds ? { only_ids: start.onlyIds } : {}),
              cursor: from,
            },
          });
        } catch (e) {
          // The batch never landed: keep the resume point and stop cleanly.
          setStalled({
            cursor: from,
            ...(start.onlyIds ? { onlyIds: start.onlyIds } : {}),
            priorResults: collected,
            expectedTotal: total,
            message: e instanceof Error ? e.message : "The batch failed",
          });
          throw e;
        }
        collected.push(...batch.results);
        total = batch.total;
        processed = batch.processed;
        cursor = batch.next_cursor;
        setProgress({ processed, total });
      }

      return {
        results: collected,
        attempted: collected.length,
        succeeded: collected.filter((r) => r.ok).length,
        failed: collected.filter((r) => !r.ok).length,
        total,
      };
    },
    onMutate: () => setStalled(null),
    onSuccess: async (r: RunReport) => {
      setReport(r);
      setProgress(null);
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
    onError: async (e: Error) => {
      setProgress(null);
      toastError(e);
      // Rows that did commit before the stall are real changes: refresh.
      await qc.invalidateQueries();
    },
  });

  const eligibleRows = useMemo(() => (preview?.rows ?? []).filter((r) => r.eligible), [preview]);
  const skippedRows = useMemo(() => (preview?.rows ?? []).filter((r) => !r.eligible), [preview]);
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
            <Loader2 className="h-4 w-4 animate-spin" /> Checking {countOf(request)} selected
            record(s)…
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
              <p className="mb-1 font-medium">Records that will change ({eligibleRows.length})</p>
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

            {exec.isPending && progress && (
              <div className="space-y-1" aria-live="polite">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying {progress.processed} of {progress.total}…
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.round((progress.processed / Math.max(1, progress.total)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {stalled && !exec.isPending && (
              <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="flex items-center gap-1.5 font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Stopped after {stalled.priorResults.length} of {stalled.expectedTotal}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stalled.message}. Everything before this point is already saved.
                </p>
                <Button size="sm" variant="outline" onClick={() => exec.mutate(stalled)}>
                  Resume from record {stalled.cursor + 1}
                </Button>
              </div>
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
                  onClick={() => exec.mutate({ onlyIds: failures.map((f) => f.id), cursor: 0 })}
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
                onClick={() => exec.mutate({ cursor: 0 })}
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

type RunStart = {
  cursor?: number;
  onlyIds?: string[];
  priorResults?: ExecItemResult[];
  expectedTotal?: number;
};

type Stall = {
  cursor: number;
  onlyIds?: string[];
  priorResults: ExecItemResult[];
  expectedTotal: number;
  message: string;
};

type RunReport = {
  results: ExecItemResult[];
  attempted: number;
  succeeded: number;
  failed: number;
  total: number;
};

function countOf(request: PreviewInput | null): number {
  if (!request) return 0;
  if (request.kind === "candidate_assign") return request.candidate_profile_ids.length;
  if (request.kind === "position_pause") return request.position_ids.length;
  return request.match_ids.length;
}
