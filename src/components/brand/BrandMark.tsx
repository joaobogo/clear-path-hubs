import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: number;
  className?: string;
  decorative?: boolean;
}

/** Icon-only mark. Use for collapsed sidebar, favicon-scale contexts,
 *  loading screens, and email header icons. */
export function BrandMark({ size = 24, className, decorative = true }: BrandMarkProps) {
  return (
    <img
      src={brand.logos.icon}
      alt={decorative ? "" : brand.name}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}

export default BrandMark;
