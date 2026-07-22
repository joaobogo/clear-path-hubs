import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCandidateCvDownload } from "@/lib/cv-download.functions";
import { Download, Loader2 } from "lucide-react";

type Props = {
  matchId: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
};

export function DownloadCvButton({
  matchId,
  variant = "outline",
  size = "sm",
  className,
  label = "Download CV",
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      const res = await getCandidateCvDownload({ data: { matchId } });
      // Signed URL includes Content-Disposition: attachment via `download` option.
      const a = document.createElement("a");
      a.href = res.url;
      a.rel = "noopener";
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not download CV");
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
      data-qa-action="download-cv"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
