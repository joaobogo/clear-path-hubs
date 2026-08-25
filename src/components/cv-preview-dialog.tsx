import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchCvDownloadLink,
  invalidateCvLink,
  cvLinkExpiryMs,
} from "@/lib/cv-download-cache";
import { describeCvDownloadFailure, type CvDownloadFailure } from "@/lib/cv-download-error";
import { DownloadCvButton } from "@/components/download-cv-button";

/** Below this width a full-height PDF frame is unreadable — open a tab instead. */
const MOBILE_MAX_WIDTH = 640;

/**
 * In-page CV preview. Opens the PDF inside a dialog (no new tab, no download)
 * using the same short-lived signed link the download path uses, so the
 * server-side contact-release rule still gates access. Each open is audited by
 * the server as a "previewed" entry in the CV access trail.
 *
 * On small screens the file opens in a new tab rather than a cramped modal.
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
  const [renderFailed, setRenderFailed] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = null;
  };

  const load = useCallback(
    async (fresh = false) => {
      setLoading(true);
      setFailure(null);
      setRenderFailed(false);
      setIframeLoaded(false);
      if (fresh) invalidateCvLink(matchId);
      try {
        const res = await fetchCvDownloadLink({
          matchId,
          disposition: "inline",
          fresh,
        });
        setUrl(res.url);
        // Transparent refresh: re-sign shortly before the link dies so a modal
        // left open keeps rendering without the reader doing anything.
        clearTimer();
        const due = Math.max(cvLinkExpiryMs(res) - Date.now(), 15_000);
        refreshTimer.current = setTimeout(() => {
          void load(true);
        }, due);
      } catch (e: unknown) {
        invalidateCvLink(matchId);
        setUrl(null);
        setFailure(describeCvDownloadFailure(e));
      } finally {
        setLoading(false);
      }
    },
    [matchId],
  );

  /** Radix locks the page with body{pointer-events:none} while a modal is up;
   * if the content unmounts mid-open the lock survives and the page looks
   * frozen until a reload. Always hand interaction back ourselves. */
  const releasePageInteraction = () => {
    if (typeof document !== "undefined") document.body.style.pointerEvents = "";
  };

  useEffect(
    () => () => {
      clearTimer();
      releasePageInteraction();
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      clearTimer();
      releasePageInteraction();
    }
  }, [open]);


  function handleClick() {
    const isMobile =
      typeof window !== "undefined" && window.innerWidth < MOBILE_MAX_WIDTH;
    if (isMobile) {
      // Pop the tab synchronously so it is not treated as a blocked popup.
      const tab = window.open("", "_blank");
      void fetchCvDownloadLink({ matchId, disposition: "inline" })
        .then((res) => {
          if (tab) {
            try {
              tab.opener = null;
            } catch {
              /* cross-origin guard */
            }
            tab.location.replace(res.url);
          } else window.open(res.url, "_blank", "noopener,noreferrer");
        })
        .catch((e: unknown) => {
          tab?.close();
          invalidateCvLink(matchId);
          setFailure(describeCvDownloadFailure(e));
          setOpen(true);
        });
      return;
    }
    setOpen(true);
    if (!url) void load();
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        data-qa-action="preview-cv"
        onClick={handleClick}
      >
        <Eye className="mr-1.5 h-4 w-4" aria-hidden />
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            clearTimer();
            releasePageInteraction();
          }
        }}
      >
        <DialogContent className="max-w-4xl" data-qa="cv-preview-dialog">


          <DialogHeader>
            <DialogTitle>
              CV{candidateName ? ` — ${candidateName}` : ""}
            </DialogTitle>
            <DialogDescription>
              Read it here, or download a copy. Every open is logged.
            </DialogDescription>
          </DialogHeader>
          <div className="relative h-[70vh] overflow-hidden overscroll-contain rounded-md border bg-muted/30">
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
              renderFailed ? (
                <div
                  className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
                  data-qa="cv-preview-fallback"
                >
                  <p className="text-sm font-medium">Preview unavailable — download instead</p>
                  <p className="text-xs text-muted-foreground">
                    This browser cannot show PDFs inline. The file itself is fine.
                  </p>
                  <DownloadCvButton matchId={matchId} mode="download" />
                </div>
              ) : (
                <>
                  {!iframeLoaded && (
                    <div
                      className="absolute inset-0 z-10 flex flex-col gap-4 bg-background p-8"
                      aria-busy="true"
                      aria-label="Loading CV preview"
                    >
                      <Skeleton className="h-8 w-1/3" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-4/5" />
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                      </div>
                      <Skeleton className="mt-auto h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  )}
                  <iframe
                    src={url}
                    title="Candidate CV"
                    className="h-full w-full"
                    onLoad={() => setIframeLoaded(true)}
                    onError={() => setRenderFailed(true)}
                  />
                </>
              )
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
