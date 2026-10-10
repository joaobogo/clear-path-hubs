import { Link } from "@tanstack/react-router";
import { brand } from "@/config/brand";
import { BRAND_LINE } from "@/config/public-navigation";
import { cn } from "@/lib/utils";

/** Wordmark plus "Hiring, handled." — header, footer and share cards. */
export function BrandMark({
  lazy = false,
  showLine = true,
  className,
}: {
  /** Footer mark is below the fold — defer it so it never competes with LCP. */
  lazy?: boolean;
  showLine?: boolean;
  className?: string;
}) {
  const height = 28;
  // Cropped logo intrinsic aspect ratio is ~4.15:1.
  const width = Math.round(height * 4.15);
  return (
    <Link
      to="/"
      aria-label="TaaSFlow — Home"
      className={cn("inline-flex shrink-0 items-center gap-3 rounded-[var(--r-1)]", className)}
    >
      <img
        src={brand.logos.primary}
        alt="TaaSFlow"
        width={width}
        height={height}
        loading={lazy ? "lazy" : "eager"}
        decoding={lazy ? "async" : "sync"}
        {...(lazy ? {} : { fetchPriority: "high" as const })}
        className="h-7 w-auto max-w-none shrink-0"
      />
      {showLine ? (
        <span className="hidden whitespace-nowrap text-sm text-[color:var(--slate)] [font-stretch:88%] sm:inline">
          {BRAND_LINE}
        </span>
      ) : null}
    </Link>
  );
}
