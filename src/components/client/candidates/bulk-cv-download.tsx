import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Check, Download, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBulkCvDownload, type BulkCvTarget } from "@/lib/client/bulk-cv-download";

/**
 * Bulk CV download: one ZIP for many candidates, with a visible row per
 * candidate so a missing or blocked CV is obvious instead of silently absent.
 */
export function BulkCvDownloadButton({
  targets,
  label,
  disabledReason,
  className,
}: {
  targets: BulkCvTarget[];
  label?: string;
  disabledReason?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const bulk = useBulkCvDownload();
  const count = targets.length;

  async function run() {
    setOpen(true);
    const result = await bulk.start(targets);
    if (!result) return;
    if (result.failed === 0) toast.success(`${result.ok} CVs downloaded as one ZIP`);
    else if (result.ok > 0) toast.warning(`${result.ok} downloaded · ${result.failed} unavailable`);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={className}
        onClick={run}
        disabled={count === 0 || Boolean(disabledReason) || bulk.busy}
        title={disabledReason ?? (count === 0 ? "No candidates with a released CV" : undefined)}
        data-qa-action="bulk-download-cvs"
      >
        {bulk.busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Package className="mr-2 h-4 w-4" aria-hidden />
        )}
        {bulk.busy ? "Preparing ZIP…" : (label ?? `Download CVs (${count})`)}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (bulk.busy) return;
          setOpen(next);
          if (!next) bulk.reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Downloading CVs</DialogTitle>
            <DialogDescription>
              {bulk.phase === "zipping"
                ? "Building the ZIP file…"
                : bulk.phase === "done"
                  ? `${bulk.counts.done} of ${bulk.counts.total} CVs are in your ZIP.`
                  : `Fetching the latest CV for ${bulk.counts.total} candidates.`}
            </DialogDescription>
          </DialogHeader>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={bulk.counts.total}
            aria-valuenow={bulk.counts.done + bulk.counts.failed}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${
                  bulk.counts.total
                    ? Math.round(
                        ((bulk.counts.done + bulk.counts.failed) / bulk.counts.total) * 100,
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border text-sm">
            {bulk.items.map((item) => (
              <li key={item.matchId} className="flex items-start gap-2 px-3 py-2">
                <span className="mt-0.5 shrink-0">
                  {item.state === "done" ? (
                    <Check className="h-4 w-4 text-success" aria-hidden />
                  ) : item.state === "error" ? (
                    <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
                  ) : item.state === "running" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span
                    className={`block text-xs ${
                      item.state === "error" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {item.state === "done"
                      ? (item.filename ?? "Added to ZIP")
                      : item.state === "error"
                        ? item.error
                        : item.state === "running"
                          ? "Fetching…"
                          : "Waiting"}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {bulk.fatal && <p className="text-sm text-destructive">{bulk.fatal}</p>}

          <DialogFooter className="gap-2 sm:justify-between">
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {bulk.counts.done} downloaded
              {bulk.counts.failed > 0 ? ` · ${bulk.counts.failed} unavailable` : ""}
            </span>
            <span className="flex gap-2">
              {bulk.counts.failed > 0 && !bulk.busy && (
                <Button type="button" variant="outline" size="sm" onClick={() => bulk.retryFailed()}>
                  Retry {bulk.counts.failed} failed
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={bulk.busy}
                onClick={() => {
                  setOpen(false);
                  bulk.reset();
                }}
              >
                Close
              </Button>
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
