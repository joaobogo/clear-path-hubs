import { ArrowUpRight } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";

import { isConversionPath } from "@/components/marketing/ecosystem-footer-row";
import { trackEvent } from "@/lib/tracking/pixels";

import { PublicPage, PublicSection } from "@/components/marketing/site-shell";
import {
  CROSS_SELLS,
  FGV,
  ecosystemHref,
  type CrossSellTrigger,
} from "@/config/ecosystem";

/**
 * One contextual sibling-brand referral. Render at most one per page, and only
 * when the page's own context matches the trigger.
 */
export function EcosystemCrossSell({ trigger }: { trigger: CrossSellTrigger }) {
  const { brand, question, body, cta } = CROSS_SELLS[trigger];
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Conversion routes (pricing, intake, checkout, booking, apply) keep the
  // parent-company identification in the footer but never carry a sibling
  // outbound link — an exit at the decision moment costs more than the referral.
  if (isConversionPath(pathname)) return null;

  return (
    <PublicSection>
      <PublicPage>
        <aside
          aria-label={`${brand.name} referral`}
          className="rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-6 sm:p-8"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/75">
            {FGV.endorsement}
          </p>
          <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-2xl">
            {question}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
            {body}
          </p>
          <a
            href={ecosystemHref(brand.url, trigger)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent("ecosystem_link_click", {
                brand: brand.id,
                placement: `cross_sell_${trigger}`,
                page_path: pathname,
              })
            }
            className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-paper)] px-4 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            {cta}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </aside>
      </PublicPage>
    </PublicSection>
  );
}
