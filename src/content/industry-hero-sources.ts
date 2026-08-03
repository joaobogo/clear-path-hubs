/**
 * Responsive source sets for the commissioned in-repo industry heroes.
 *
 * `vite-imagetools` generates AVIF and WebP variants at 640/1024/1600 CSS
 * pixels at build time, so mobile visitors download roughly a quarter of the
 * bytes of the original 1600px JPEG while desktop keeps the full-width crop.
 * Remote (Unsplash) heroes are handled separately — see `remoteHeroSrcSet`.
 */

type SrcSetMap = Record<string, string>;

const WIDTHS = "640;1024;1600";

const avifGlob = import.meta.glob("/src/assets/industry-*-hero.jpg", {
  query: `?w=${WIDTHS}&format=avif&as=srcset`,
  import: "default",
  eager: true,
}) as SrcSetMap;

const webpGlob = import.meta.glob("/src/assets/industry-*-hero.jpg", {
  query: `?w=${WIDTHS}&format=webp&as=srcset`,
  import: "default",
  eager: true,
}) as SrcSetMap;

const jpegGlob = import.meta.glob("/src/assets/industry-*-hero.jpg", {
  query: `?w=${WIDTHS}&format=jpg&as=srcset`,
  import: "default",
  eager: true,
}) as SrcSetMap;

function byBaseName(map: SrcSetMap): SrcSetMap {
  const out: SrcSetMap = {};
  for (const [file, value] of Object.entries(map)) {
    const base = file.split("/").pop();
    if (base) out[base] = value;
  }
  return out;
}

const AVIF = byBaseName(avifGlob);
const WEBP = byBaseName(webpGlob);
const JPEG = byBaseName(jpegGlob);

export type HeroSourceSet = {
  avif?: string;
  webp?: string;
  fallback?: string;
  sizes: string;
};

/** Layout-accurate `sizes`: near full-width on mobile, ~half the grid on desktop. */
export const HERO_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 92vw, 720px";

/**
 * Returns AVIF/WebP/JPEG srcsets for a commissioned hero, keyed by the file
 * name embedded in the bundled `src` (e.g. `industry-legal-hero.jpg`).
 */
export function getHeroSourceSet(src: string): HeroSourceSet | undefined {
  if (!src || /^https?:/i.test(src)) return remoteHeroSourceSet(src);
  const base = Object.keys(AVIF).find((name) => src.includes(name.replace(/\.jpg$/, "")));
  if (!base) return undefined;
  return { avif: AVIF[base], webp: WEBP[base], fallback: JPEG[base], sizes: HERO_SIZES };
}

/**
 * Unsplash already serves modern formats via `auto=format`; we only need the
 * width candidates so mobile stops downloading the 1600px render.
 */
export function remoteHeroSourceSet(src: string): HeroSourceSet | undefined {
  if (!/^https:\/\/images\.unsplash\.com\//i.test(src)) return undefined;
  const candidates = [640, 1024, 1600]
    .map((w) => `${src.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`)
    .join(", ");
  return { fallback: candidates, sizes: HERO_SIZES };
}
