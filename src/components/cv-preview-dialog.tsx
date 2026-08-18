import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchCvDownloadLink, invalidateCvLink } from "@/lib/cv-download-cache";
import { describeCvDownloadFailure, type CvDownloadFailure } from "@/lib/cv-download-error";
import { DownloadCvButton } from "@/components/download-cv-button";

/**
 * In-page CV preview. Opens the PDF inside a dialog (no new tab, no download)
 * using the same short-lived signed link the download path uses, so the
 * server-side contact-release rule still gates access.
 */
export function CvPreviewDialog({
  matchId,
  candidateName,
  variant = "outline",
  size = "sm",
  label = "Preview CV",
}: {
  matchId: string;
  candidateName?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<CvDownloadFailure | null>(null);

  async function load(fresh = false) {
    setLoading(true);
    setFailure(null);
    if (fresh) invalidateCvLink(matchId);
    try {
      const res = await fetchCvDownloadLink({
        matchId,
        disposition: "inline",
        fresh,
      });
      setUrl(res.url);
    } catch (e: unknown) {
      invalidateCvLink(matchId);
      setUrl(null);
      setFailure(describeCvDownloadFailure(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        data-qa-action="preview-cv"
        onClick={() => {
          setOpen(true);
          if (!url) void load();
        }}
      >
        <Eye className="mr-1.5 h-4 w-4" aria-hidden />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              CV{candidateName ? ` — ${candidateName}` : ""}
            </DialogTitle>
            <DialogDescription>
              Read it here, or download a copy. Every open is logged.
            </DialogDescription>
          </DialogHeader>
          <div className="h-[70vh] overflow-hidden rounded-md border bg-muted/30">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Opening the CV…
              </div>
            ) : failure ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="text-sm font-medium text-destructive">{failure.message}</p>
                <p className="text-xs text-muted-foreground">{failure.hint}</p>
                {failure.retryable && (
                  <Button size="sm" variant="outline" onClick={() => void load(true)}>
                    Try again
                  </Button>
                )}
              </div>
            ) : url ? (
              <iframe src={url} title="Candidate CV" className="h-full w-full" />
            ) : null}
          </div>
          <div className="flex justify-end">
            <DownloadCvButton matchId={matchId} mode="download" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
