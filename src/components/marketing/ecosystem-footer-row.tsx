import { ECOSYSTEM_FOOTER_BRANDS, FGV, ecosystemHref } from "@/config/ecosystem";

/**
 * Subtle "Part of Flow Group Ventures" row for the footer. Keeps TaaSFlow
 * primary — sibling brands are listed as quiet, contextual links only.
 */
export function EcosystemFooterRow() {
  return (
    <div className="mt-10 border-t border-[color:var(--brand-navy)]/10 pt-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
        Part of{" "}
        <a
          href={FGV.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] rounded"
        >
          {FGV.name}
        </a>
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {ECOSYSTEM_FOOTER_BRANDS.map((b) => (
          <li key={b.id}>
            <a
              href={ecosystemHref(b.url, "single-role")}
              target="_blank"
              rel="noopener noreferrer"
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
    </div>
  );
}
