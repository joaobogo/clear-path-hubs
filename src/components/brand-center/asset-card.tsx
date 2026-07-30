import { useCallback, useState } from "react";
import { Download, Loader2, Ruler } from "lucide-react";
import {
  exportFile,
  exportScenePng,
  exportSceneSvg,
  isVectorSafe,
  sceneToSvg,
  type Scene,
} from "@/lib/brand-center/scene";
import { assetFilename, type BrandAsset } from "@/lib/brand-center/registry";
import { Button } from "@/components/ui/button";

export function ScenePreview({
  scene,
  alt,
  showGuides,
  maxHeight = 320,
}: {
  scene: Scene;
  alt: string;
  showGuides?: boolean;
  maxHeight?: number;
}) {
  const svg = sceneToSvg(scene, { guides: showGuides });
  return (
    <div
      role="img"
      aria-label={alt}
      className="w-full overflow-hidden rounded-lg border border-border bg-muted/40 [&>svg]:h-auto [&>svg]:w-full"
      style={{ maxHeight }}
      // Serialized from the same scene data the PNG export uses.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const STATUS_LABEL: Record<BrandAsset["status"], string> = {
  approved: "Approved",
  review: "In review — not for publication",
  blocked: "Blocked — missing approved source",
  deprecated: "Deprecated",
};

export function AssetCard({ asset }: { asset: BrandAsset }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guides, setGuides] = useState(false);

  const scene = asset.scene?.();

  const download = useCallback(
    async (format: "png" | "svg") => {
      setBusy(format);
      setError(null);
      setResult(null);
      try {
        const filename = assetFilename(asset, format);
        if (asset.fileUrl) {
          const r = await exportFile(asset.fileUrl, filename, asset.fileMime ?? "image/png");
          setResult(`${r.filename} — ${(r.bytes / 1024).toFixed(0)} KB`);
        } else if (scene) {
          const r =
            format === "svg"
              ? await exportSceneSvg(scene, filename)
              : await exportScenePng(scene, filename);
          setResult(`${r.filename} — ${r.width}x${r.height}, ${(r.bytes / 1024).toFixed(0)} KB`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed.");
      } finally {
        setBusy(null);
      }
    },
    [asset, scene],
  );

  const dimension = asset.width && asset.height ? `${asset.width} × ${asset.height} px` : "dimensions n/a";
  const hasGuides = Boolean(scene?.guides?.length);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-base font-semibold text-foreground">{asset.name}</h4>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Ruler className="size-3.5" aria-hidden /> {dimension} · {asset.concept} · v{asset.version}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
            asset.status === "approved"
              ? "border-[color:var(--brand-success)] text-[color:var(--brand-success)]"
              : asset.status === "review"
                ? "border-[color:var(--brand-warning)] text-foreground"
                : "border-destructive text-destructive"
          }`}
        >
          {STATUS_LABEL[asset.status]}
        </span>
      </div>

      {scene ? (
        <ScenePreview scene={scene} alt={`${asset.name}, ${dimension}`} showGuides={guides} />
      ) : asset.fileUrl ? (
        <div className="flex items-center justify-center rounded-lg border border-border bg-[color:var(--brand-navy-dark)] p-6">
          <img src={asset.fileUrl} alt={asset.name} className="max-h-32 w-auto" loading="lazy" />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No artwork produced. {asset.notes}
        </p>
      )}

      <p className="text-sm text-muted-foreground">{asset.notes}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2 print:hidden">
        {asset.status !== "blocked" &&
          asset.formats.map((format) => {
            if (format === "svg" && scene && !isVectorSafe(scene)) return null;
            return (
              <Button
                key={format}
                size="sm"
                variant={format === "png" ? "default" : "outline"}
                className="min-h-11 min-w-11"
                disabled={busy !== null}
                onClick={() => download(format as "png" | "svg")}
              >
                {busy === format ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="size-4" aria-hidden />
                )}
                <span>
                  Download {asset.name} {asset.concept} {format.toUpperCase()}
                  {asset.width ? ` ${asset.width}×${asset.height}` : ""}
                </span>
              </Button>
            );
          })}
        {hasGuides && (
          <Button
            size="sm"
            variant="ghost"
            className="min-h-11"
            aria-pressed={guides}
            onClick={() => setGuides((g) => !g)}
          >
            {guides ? "Hide safe areas" : "Show safe areas"}
          </Button>
        )}
      </div>

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {error ? <span className="text-destructive">Export failed: {error}</span> : result}
      </p>
    </article>
  );
}
