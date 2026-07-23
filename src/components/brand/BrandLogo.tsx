/**
 * BrandLogo — canonical logo renderer.
 *
 * Variants:
 *  - "full"    Full wordmark (default). Uses light/dark background asset.
 *  - "compact" Same as full for now; reserved for stacked lockup.
 *  - "icon"    Icon-only mark (mobile nav, collapsed sidebar, app icon).
 *
 * Backgrounds:
 *  - "light"   For white / paper surfaces (public site, workspace default).
 *  - "dark"    For navy / dark surfaces (CTA sections, workspace dark mode).
 *
 * Accessibility: pass `decorative` when adjacent text already names the brand
 * (footer, header wordmark next to nav) so screen readers do not repeat it.
 */

import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

type Variant = "full" | "compact" | "icon";
type Background = "light" | "dark";

interface BrandLogoProps {
  variant?: Variant;
  background?: Background;
  className?: string;
  height?: number;
  decorative?: boolean;
  label?: string;
}

export function BrandLogo({
  variant = "full",
  background = "light",
  className,
  height = 28,
  decorative = false,
  label,
}: BrandLogoProps) {
  const src =
    variant === "icon"
      ? brand.logos.icon
      : background === "dark"
        ? brand.logos.dark
        : brand.logos.light;

  const alt = decorative ? "" : (label ?? brand.name);

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={decorative || undefined}
      height={height}
      style={{ height }}
      className={cn("w-auto select-none", className)}
      draggable={false}
    />
  );
}

export default BrandLogo;
