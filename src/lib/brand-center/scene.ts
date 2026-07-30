/**
 * Brand Center — deterministic scene graph.
 *
 * Every exportable asset is described once as data and rendered twice:
 * to SVG (on-screen preview, and vector export when the scene contains no
 * raster nodes) and to Canvas (exact-pixel PNG export). One description means
 * the preview and the download can never drift apart.
 */

export type FontRole = "display" | "sans" | "mono";

export const FONT_STACK: Record<FontRole, string> = {
  display: "'Fraunces', 'Iowan Old Style', Georgia, serif",
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
};

export type SceneNode =
  | {
      t: "rect";
      x: number; y: number; w: number; h: number;
      fill?: string; rx?: number; stroke?: string; sw?: number; opacity?: number;
    }
  | {
      t: "circle";
      cx: number; cy: number; r: number;
      fill?: string; stroke?: string; sw?: number; opacity?: number;
    }
  | {
      t: "line";
      x1: number; y1: number; x2: number; y2: number;
      stroke: string; sw?: number; dash?: number[]; opacity?: number;
    }
  | {
      t: "path";
      d: string; fill?: string; stroke?: string; sw?: number; opacity?: number;
    }
  | {
      t: "text";
      x: number; y: number; text: string;
      size: number; weight?: number; fill?: string; font?: FontRole;
      anchor?: "start" | "middle" | "end";
      tracking?: number; // px letter-spacing
      opacity?: number;
      uppercase?: boolean;
    }
  | {
      t: "image";
      href: string; x: number; y: number; w: number; h: number; opacity?: number;
    };

export interface Scene {
  width: number;
  height: number;
  background: string;
  nodes: SceneNode[];
  /** Optional overlay drawn only in the on-screen preview (safe areas, guides). */
  guides?: SceneNode[];
}

export const isVectorSafe = (scene: Scene): boolean =>
  scene.nodes.every((n) => n.t !== "image");

/* ------------------------------------------------------------------ *
 * SVG
 * ------------------------------------------------------------------ */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function nodeToSvg(n: SceneNode): string {
  const o = n.opacity !== undefined ? ` opacity="${n.opacity}"` : "";
  switch (n.t) {
    case "rect":
      return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}"${
        n.rx ? ` rx="${n.rx}"` : ""
      } fill="${n.fill ?? "none"}"${n.stroke ? ` stroke="${n.stroke}" stroke-width="${n.sw ?? 1}"` : ""}${o}/>`;
    case "circle":
      return `<circle cx="${n.cx}" cy="${n.cy}" r="${n.r}" fill="${n.fill ?? "none"}"${
        n.stroke ? ` stroke="${n.stroke}" stroke-width="${n.sw ?? 1}"` : ""
      }${o}/>`;
    case "line":
      return `<line x1="${n.x1}" y1="${n.y1}" x2="${n.x2}" y2="${n.y2}" stroke="${n.stroke}" stroke-width="${
        n.sw ?? 1
      }"${n.dash ? ` stroke-dasharray="${n.dash.join(" ")}"` : ""}${o}/>`;
    case "path":
      return `<path d="${n.d}" fill="${n.fill ?? "none"}"${
        n.stroke ? ` stroke="${n.stroke}" stroke-width="${n.sw ?? 1}" stroke-linecap="round"` : ""
      }${o}/>`;
    case "text": {
      const content = n.uppercase ? n.text.toUpperCase() : n.text;
      return `<text x="${n.x}" y="${n.y}" fill="${n.fill ?? "#0A111F"}" font-family="${
        FONT_STACK[n.font ?? "sans"]
      }" font-size="${n.size}" font-weight="${n.weight ?? 400}" text-anchor="${
        n.anchor ?? "start"
      }"${n.tracking ? ` letter-spacing="${n.tracking}"` : ""}${o}>${esc(content)}</text>`;
    }
    case "image":
      return `<image href="${n.href}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" preserveAspectRatio="xMidYMid meet"${o}/>`;
  }
}

export function sceneToSvg(scene: Scene, opts?: { guides?: boolean }): string {
  const body = [...scene.nodes, ...(opts?.guides ? scene.guides ?? [] : [])]
    .map(nodeToSvg)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" role="img"><rect width="${scene.width}" height="${scene.height}" fill="${scene.background}"/>${body}</svg>`;
}

/* ------------------------------------------------------------------ *
 * Canvas (PNG export)
 * ------------------------------------------------------------------ */

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
}

export async function renderSceneToCanvas(scene: Scene): Promise<HTMLCanvasElement> {
  if (typeof document === "undefined") throw new Error("Canvas export requires a browser.");
  if (typeof (document as Document & { fonts?: FontFaceSet }).fonts?.ready !== "undefined") {
    await document.fonts.ready;
  }

  const canvas = document.createElement("canvas");
  canvas.width = scene.width;
  canvas.height = scene.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  ctx.fillStyle = scene.background;
  ctx.fillRect(0, 0, scene.width, scene.height);
  ctx.textBaseline = "alphabetic";

  for (const n of scene.nodes) {
    ctx.save();
    ctx.globalAlpha = n.opacity ?? 1;
    switch (n.t) {
      case "rect": {
        if (n.fill) {
          ctx.fillStyle = n.fill;
          roundRect(ctx, n.x, n.y, n.w, n.h, n.rx ?? 0);
          ctx.fill();
        }
        if (n.stroke) {
          ctx.strokeStyle = n.stroke;
          ctx.lineWidth = n.sw ?? 1;
          roundRect(ctx, n.x, n.y, n.w, n.h, n.rx ?? 0);
          ctx.stroke();
        }
        break;
      }
      case "circle": {
        ctx.beginPath();
        ctx.arc(n.cx, n.cy, n.r, 0, Math.PI * 2);
        if (n.fill) { ctx.fillStyle = n.fill; ctx.fill(); }
        if (n.stroke) { ctx.strokeStyle = n.stroke; ctx.lineWidth = n.sw ?? 1; ctx.stroke(); }
        break;
      }
      case "line": {
        ctx.beginPath();
        if (n.dash) ctx.setLineDash(n.dash);
        ctx.moveTo(n.x1, n.y1);
        ctx.lineTo(n.x2, n.y2);
        ctx.strokeStyle = n.stroke;
        ctx.lineWidth = n.sw ?? 1;
        ctx.stroke();
        break;
      }
      case "path": {
        const p = new Path2D(n.d);
        if (n.fill) { ctx.fillStyle = n.fill; ctx.fill(p); }
        if (n.stroke) {
          ctx.strokeStyle = n.stroke;
          ctx.lineWidth = n.sw ?? 1;
          ctx.lineCap = "round";
          ctx.stroke(p);
        }
        break;
      }
      case "text": {
        const content = n.uppercase ? n.text.toUpperCase() : n.text;
        ctx.font = `${n.weight ?? 400} ${n.size}px ${FONT_STACK[n.font ?? "sans"]}`;
        ctx.fillStyle = n.fill ?? "#0A111F";
        ctx.textAlign = (n.anchor ?? "start") === "middle" ? "center" : (n.anchor ?? "start") as CanvasTextAlign;
        const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
        if (n.tracking) c.letterSpacing = `${n.tracking}px`;
        ctx.fillText(content, n.x, n.y);
        if (n.tracking) c.letterSpacing = "0px";
        break;
      }
      case "image": {
        const img = await loadImage(n.href);
        const scale = Math.min(n.w / img.naturalWidth, n.h / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, n.x + (n.w - dw) / 2, n.y + (n.h - dh) / 2, dw, dh);
        break;
      }
    }
    ctx.restore();
  }

  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ------------------------------------------------------------------ *
 * Downloads
 * ------------------------------------------------------------------ */

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface ExportResult {
  filename: string;
  width: number;
  height: number;
  bytes: number;
  mime: string;
}

/** Renders, verifies pixel dimensions, then downloads a PNG. */
export async function exportScenePng(scene: Scene, filename: string): Promise<ExportResult> {
  const canvas = await renderSceneToCanvas(scene);
  if (canvas.width !== scene.width || canvas.height !== scene.height) {
    throw new Error(
      `Dimension mismatch: expected ${scene.width}x${scene.height}, produced ${canvas.width}x${canvas.height}`,
    );
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG encoding failed.");
  triggerDownload(blob, filename);
  return { filename, width: canvas.width, height: canvas.height, bytes: blob.size, mime: "image/png" };
}

/** Downloads the scene as SVG. Only offered when the scene is vector-safe. */
export async function exportSceneSvg(scene: Scene, filename: string): Promise<ExportResult> {
  if (!isVectorSafe(scene)) {
    throw new Error("Scene contains raster artwork; SVG export is not vector-safe.");
  }
  const blob = new Blob([sceneToSvg(scene)], { type: "image/svg+xml;charset=utf-8" });
  triggerDownload(blob, filename);
  return { filename, width: scene.width, height: scene.height, bytes: blob.size, mime: "image/svg+xml" };
}

/** Downloads an existing file (master logo PNGs, etc.) under the brand filename convention. */
export async function exportFile(url: string, filename: string, mime: string): Promise<ExportResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Source asset unavailable (${res.status}).`);
  const blob = await res.blob();
  triggerDownload(blob, filename);
  let width = 0;
  let height = 0;
  if (mime.startsWith("image/") && mime !== "image/svg+xml") {
    try {
      const img = await loadImage(url);
      width = img.naturalWidth;
      height = img.naturalHeight;
    } catch { /* dimensions unverifiable — reported as 0 */ }
  }
  return { filename, width, height, bytes: blob.size, mime };
}
