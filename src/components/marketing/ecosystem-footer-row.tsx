import { useRouterState } from "@tanstack/react-router";
import { ECOSYSTEM_FOOTER_BRANDS, FGV, ecosystemHref } from "@/config/ecosystem";
import { trackEvent } from "@/lib/tracking/pixels";

/**
 * Subtle "Part of Flow Group Ventures" row for the footer. Keeps TaaSFlow
 * primary — sibling brands are listed as quiet, contextual links only.
 *
 * Two rules apply:
 *  1. Conversion pages never show sibling-brand links. Outbound links at the
 *     decision moment leak intent traffic, so those pages keep the ownership
 *     attribution only.
 *  2. Every sibling-brand click is measured, so the row's effect is visible
 *     instead of assumed.
 */

/** Paths where a visitor is mid-decision. Prefix match. */
const CONVERSION_PATHS: readonly string[] = [
  "/intake",
  "/pilot",
  "/pricing",
  "/checkout",
  "/contact",
  "/book-call",
  "/login",
  "/signup",
  "/jobs",
  "/apply",
  "/candidate-join",
];

export function isConversionPath(pathname: string): boolean {
  return CONVERSION_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function EcosystemFooterRow() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const conversion = isConversionPath(pathname);

  return (
    <div className="mt-10 border-t border-[color:var(--brand-navy)]/10 pt-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
        Part of{" "}
        {conversion ? (
          <span>{FGV.name}</span>
        ) : (
          <a
            href={FGV.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent("ecosystem_link_click", {
                brand: "fgv",
                placement: "footer_ecosystem",
                page_path: pathname,
              })
            }
            className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] rounded"
          >
            {FGV.name}
          </a>
        )}
      </p>
      {!conversion ? (
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {ECOSYSTEM_FOOTER_BRANDS.map((b) => (
            <li key={b.id}>
              <a
                href={ecosystemHref(b.url, "footer_ecosystem")}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent("ecosystem_link_click", {
                    brand: b.id,
                    placement: "footer_ecosystem",
                    page_path: pathname,
                  })
                }
                className="inline-flex min-h-11 items-center text-sm text-[color:var(--brand-navy)]/70 hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] rounded"
              >
                <span className="font-medium">{b.name}</span>
                <span className="ml-2 hidden text-xs text-[color:var(--brand-navy)]/55 sm:inline">
                  {b.owns}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
