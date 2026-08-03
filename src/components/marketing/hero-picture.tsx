import { getHeroSourceSet } from "@/content/industry-hero-sources";

type HeroPictureProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  /** `true` for the page's LCP image, `false` for below-the-fold heroes. */
  priority?: boolean;
};

/**
 * Renders an editorial hero as a `<picture>` with AVIF/WebP/JPEG candidates and
 * layout-accurate `sizes`, so mobile fetches the 640px render instead of the
 * full 1600px original. Falls back to a plain `<img>` when no variants exist.
 */
export function HeroPicture({
  src,
  alt,
  width,
  height,
  className,
  style,
  priority = false,
}: HeroPictureProps) {
  const sources = getHeroSourceSet(src);
  const img = (
    <img
      src={src}
      srcSet={sources?.fallback}
      sizes={sources?.sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={className}
      style={style}
    />
  );

  if (!sources?.avif && !sources?.webp) return img;

  return (
    <picture>
      {sources.avif ? <source type="image/avif" srcSet={sources.avif} sizes={sources.sizes} /> : null}
      {sources.webp ? <source type="image/webp" srcSet={sources.webp} sizes={sources.sizes} /> : null}
      {img}
    </picture>
  );
}
