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
  const [error, setError] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preview = mode === "preview";

  async function run() {
    if (state === "loading") return;
    setState("loading");
    setError(null);
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
    } catch (e: any) {
      tab?.close();
      const raw = String(e?.message ?? "");
      const message = /no cv/i.test(raw)
        ? "No CV on file yet"
        : /not found|unauthor/i.test(raw)
          ? "This CV is not available to you yet"
          : raw || `Could not ${preview ? "open" : "download"} the CV`;
      setState("error");
      setError(message);
      toast.error(message);
    }
  }

  return { state, error, run, preview };
}

export function DownloadCvButton({
  matchId,
  variant = "outline",
  size = "sm",
  className,
  label,
  mode = "download",
}: Props) {
  const { state, error, run, preview } = useCvDownload(matchId, mode);
  const base = label ?? (preview ? "Preview CV" : "Download CV");
  const text =
    state === "loading"
      ? preview
        ? "Opening…"
        : "Preparing…"
      : state === "error"
        ? "Retry"
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
      {error && <span className="text-[11px] text-destructive max-w-[16rem]">{error}</span>}
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
