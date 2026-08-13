import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCandidateCvDownload } from "@/lib/cv-download.functions";
import { describeCvDownloadFailure, type CvDownloadFailure } from "@/lib/cv-download-error";
import { AlertCircle, Check, Download, Eye, Loader2, RotateCcw } from "lucide-react";


type Mode = "download" | "preview";

type Props = {
  matchId: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
  /** "download" forces a file save; "preview" opens the PDF in a new tab. */
  mode?: Mode;
};

/**
 * Shared one-click fetch of a short-lived signed URL, with explicit
 * loading / error / done states so a click never looks like it did nothing.
 */
function useCvDownload(matchId: string, mode: Mode) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [failure, setFailure] = useState<CvDownloadFailure | null>(null);
  const [attempts, setAttempts] = useState(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preview = mode === "preview";

  async function run() {
    if (state === "loading") return;
    setState("loading");
    setFailure(null);
    setAttempts((n) => n + 1);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    // Pop the tab synchronously so the browser does not treat the post-await
    // open() as a blocked popup.
    const tab = preview ? window.open("", "_blank", "noopener,noreferrer") : null;
    try {
      const res = await getCandidateCvDownload({
        data: { matchId, disposition: preview ? "inline" : "attachment" },
      });
      if (preview) {
        if (tab) tab.location.href = res.url;
        else window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        // Signed URL carries Content-Disposition: attachment via the `download` option.
        const a = document.createElement("a");
        a.href = res.url;
        a.rel = "noopener";
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setState("done");
      resetTimer.current = setTimeout(() => setState("idle"), 2500);
    } catch (e: unknown) {
      tab?.close();
      const f = describeCvDownloadFailure(e);
      setState("error");
      setFailure(f);
      toast.error(f.message, { description: f.hint });
    }
  }

  // Every run asks the server again for the candidate's current CV file and a
  // brand-new signed link, so "Retry" always pulls the latest file in storage.
  return { state, failure, attempts, run, preview };
}

export function DownloadCvButton({
  matchId,
  variant = "outline",
  size = "sm",
  className,
  label,
  mode = "download",
}: Props) {
  const { state, failure, attempts, run, preview } = useCvDownload(matchId, mode);
  const base = label ?? (preview ? "Preview CV" : "Download CV");
  const text =
    state === "loading"
      ? preview
        ? "Opening…"
        : "Preparing…"
      : state === "error"
        ? failure?.retryable
          ? preview
            ? "Retry preview"
            : "Retry download"
          : base
        : state === "done" && !preview
          ? "Downloaded"
          : base;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={state === "error" ? "outline" : variant}
        size={size}
        className={`${state === "error" ? "border-destructive/50 text-destructive" : ""} ${className ?? ""}`}
        onClick={run}
        disabled={state === "loading"}
        aria-busy={state === "loading"}
        data-qa-action={preview ? "preview-cv" : "download-cv"}
        data-state={state}
      >
        {state === "loading" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : state === "error" ? (
          <AlertCircle className="mr-2 h-4 w-4" aria-hidden />
        ) : state === "done" && !preview ? (
          <Check className="mr-2 h-4 w-4" aria-hidden />
        ) : preview ? (
          <Eye className="mr-2 h-4 w-4" aria-hidden />
        ) : (
          <Download className="mr-2 h-4 w-4" aria-hidden />
        )}
        {text}
      </Button>
      <span aria-live="polite" className="sr-only">
        {state === "loading" ? "Preparing CV download" : state === "done" ? "CV ready" : ""}
      </span>
      {failure && (
        <span
          role="alert"
          className="flex max-w-[18rem] flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5"
          data-qa="cv-download-error"
        >
          <span className="text-[11px] font-medium text-destructive">{failure.message}</span>
          <span className="text-[11px] text-muted-foreground">{failure.hint}</span>
          {failure.retryable && (
            <button
              type="button"
              onClick={run}
              disabled={state === "loading"}
              data-qa-action="retry-cv-download"
              className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline disabled:opacity-70"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Retry download
              {attempts > 1 ? ` (attempt ${attempts + 1})` : ""}
            </button>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * Text-link flavour: "Download latest CV" straight from a list row or profile
 * header. One click, same signed-URL path, same loading/error feedback.
 */
export function DownloadLatestCvLink({
  matchId,
  className,
  label = "Download latest CV",
}: {
  matchId: string;
  className?: string;
  label?: string;
}) {
  const { state, error, run } = useCvDownload(matchId, "download");
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <button
        type="button"
        onClick={run}
        disabled={state === "loading"}
        aria-busy={state === "loading"}
        data-qa-action="download-latest-cv"
        data-state={state}
        className={`inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline disabled:opacity-70 ${
          state === "error" ? "text-destructive" : "text-primary"
        }`}
      >
        {state === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : state === "error" ? (
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        ) : state === "done" ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Download className="h-3.5 w-3.5" aria-hidden />
        )}
        {state === "loading"
          ? "Preparing…"
          : state === "error"
            ? "Retry download"
            : state === "done"
              ? "Downloaded"
              : label}
      </button>
      {error && <span className="text-[11px] text-destructive">{error}</span>}
    </span>
  );
}
