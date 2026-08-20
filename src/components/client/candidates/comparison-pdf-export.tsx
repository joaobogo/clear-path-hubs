import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Check, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useComparisonPdfExport } from "@/lib/client/comparison-pdf-export";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { CompareMatrixRow } from "@/lib/client-compare";

/**
 * Export the candidate comparison as a downloadable PDF.
 *
 * Reuses the same progress-modal pattern as the bulk CV ZIP download: one row
 * per candidate, a progress bar, and a toast on completion. The PDF is built
 * client-side so the tab never triggers the browser print dialog.
 */
export function ComparisonPdfExportButton({
  candidates,
  matrix,
  observations,
  positionTitle,
  label,
}: {
  candidates: ClientCandidateDTO[];
  matrix: CompareMatrixRow[];
  observations: string[];
  positionTitle: string | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const pdf = useComparisonPdfExport();

  async function run() {
    setOpen(true);
    const result = await pdf.start(candidates, matrix, observations, positionTitle);
    if (!result) return;
    if (result.ok) {
      toast.success("Comparison PDF downloaded");
    } else {
      toast.error(pdf.fatal ?? "Could not export PDF");
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={run} disabled={pdf.busy}>
        {pdf.busy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        )}
        {pdf.busy ? "Building PDF…" : (label ?? "Export PDF")}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pdf.busy) return;
          setOpen(next);
          if (!next) pdf.reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Exporting comparison PDF</DialogTitle>
            <DialogDescription>
              {pdf.phase === "done"
                ? "Your PDF is ready in your downloads."
                : "Building the PDF from the selected candidates."}
            </DialogDescription>
          </DialogHeader>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={pdf.counts.total}
            aria-valuenow={pdf.counts.done + pdf.counts.failed}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${
                  pdf.counts.total
                    ? Math.round(((pdf.counts.done + pdf.counts.failed) / pdf.counts.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>

          <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border text-sm">
            {pdf.items.map((item) => (
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
                      ? "Added to PDF"
                      : item.state === "error"
                        ? item.error
                        : item.state === "running"
                          ? "Building…"
                          : "Waiting"}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {pdf.fatal && <p className="text-sm text-destructive">{pdf.fatal}</p>}

          <DialogFooter className="gap-2 sm:justify-between">
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {pdf.counts.done} added
              {pdf.counts.failed > 0 ? ` · ${pdf.counts.failed} failed` : ""}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pdf.busy}
              onClick={() => {
                setOpen(false);
                pdf.reset();
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
