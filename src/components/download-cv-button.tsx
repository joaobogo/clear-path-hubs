import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCandidateCvDownload } from "@/lib/cv-download.functions";
import { Download, Eye, Loader2 } from "lucide-react";

type Props = {
  matchId: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
  /** "download" forces a file save; "preview" opens the PDF in a new tab. */
  mode?: "download" | "preview";
};

export function DownloadCvButton({
  matchId,
  variant = "outline",
  size = "sm",
  className,
  label,
  mode = "download",
}: Props) {
  const [loading, setLoading] = useState(false);
  const preview = mode === "preview";
  const text = label ?? (preview ? "Preview CV" : "Download CV");

  async function handle() {
    setLoading(true);
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
        return;
      }
      // Signed URL carries Content-Disposition: attachment via the `download` option.
      const a = document.createElement("a");
      a.href = res.url;
      a.rel = "noopener";
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      tab?.close();
      toast.error(e?.message ?? `Could not ${preview ? "open" : "download"} CV`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handle}
      disabled={loading}
      data-qa-action={preview ? "preview-cv" : "download-cv"}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : preview ? (
        <Eye className="mr-2 h-4 w-4" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {text}
    </Button>
  );
}
