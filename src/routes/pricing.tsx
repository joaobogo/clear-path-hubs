import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { marketingHead, faqScript, serviceScript } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { AgencyComparator } from "@/components/marketing/agency-comparator";
import { EntitlementMatrix } from "@/components/marketing/entitlement-matrix";
import { Check } from "lucide-react";
import { RunButton, RunLinkButton } from "@/components/system/run-button";
import { PhotoBand } from "@/components/marketing/editorial-hero";
import pricingTeam from "@/assets/page-pricing-hero.jpg";
import { PRICING_GUARANTEES } from "@/content/pricing";
import {
  ABOVE_MAX_ROLES_LABEL,
  MAX_POSITIONS,
  PACKAGES,
  PRICE_PILOT_DISPLAY,
  formatUsdExact,
  subscriptionTotalsUsd,
} from "@/config/pricing-core";
import { OFFER_CATEGORY, OFFER_LAST_UPDATED_LABEL } from "@/config/offer-facts";
import { CTA_ENTERPRISE, CTA_MESSAGE, CTA_PRIMARY } from "@/config/cta";
import {
  ENTITLEMENT_POLICY,
  PUBLIC_ONEOFF_ENTITLEMENTS,
  PUBLIC_PLAN_IDS,
  PUBLIC_PLAN_LABELS,
  PUBLIC_SUBSCRIPTION_ENTITLEMENTS,
  publicSeatsLine,
} from "@/config/pricing-entitlements";

export const Route = createFileRoute("/pricing")({
  head: () =>
    marketingHead(undefined, "/pricing", {
      title: `Recruiting Packages & ${PRICE_PILOT_DISPLAY} Pilot | TaaSFlow`,
      description: `Your invoice before you sign: TaaSFlow recruiting packages by number of roles, paid once or monthly, and the ${PRICE_PILOT_DISPLAY} one-role pilot. No placement fee.`,
    }, {
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Pricing", path: "/pricing" },
      ],
      scripts: [
        serviceScript({
          name: "TaaSFlow recruiting packages",
          description:
            `${OFFER_CATEGORY}, sold as packages by number of positions: one-off (paid once) or as a subscription billed monthly. A ${PRICE_PILOT_DISPLAY} pilot covers one role, once per company. No placement fees.`,
          path: "/pricing",
          serviceType: "Recruiting",
        }),
        faqScript(ENTITLEMENT_POLICY.map((item) => ({ q: item.question, a: item.answer }))),
      ],
    }),
  component: PricingPage,
});

/* ------------------------------------------------------------------ data */

/** The seven stops, in the order they sell: the pilot, five packages, scoped. */
const STOPS: readonly { id: string; roles: number | null; label: string; short: string }[] = [
  ...PACKAGES.map((p) => ({
    id: p.id,
    roles: p.capacity,
    label: p.capacityLabel,
    short: String(p.capacity),
  })),
  { id: "enterprise", roles: null, label: ABOVE_MAX_ROLES_LABEL, short: `${MAX_POSITIONS}+` },
];

const ENTERPRISE_ID = "enterprise";

const MAIN_TIERS = PACKAGES.filter((p) => ["pilot", "growth", "scale"].includes(p.id));
const LARGER_TIERS = PACKAGES.filter((p) => !["pilot", "growth", "scale"].includes(p.id));

const TIER_BLURB: Record<string, string> = {
  pilot: "Try the full workflow on one role. Once per company.",
  growth: "For teams hiring steadily across several roles.",
  scale: "For growing teams with a busy hiring plan.",
};

/** Monthly on a subscription, the package total when paid once. Pilot is always once. */
function priceFor(id: string, capacity: number, totalUsd: number, billing: "once" | "monthly"): number {
  if (id === "pilot" || billing === "once") return totalUsd;
  return subscriptionTotalsUsd(capacity)?.monthly ?? totalUsd;
}

type Billing = "once" | "monthly";

/* ------------------------------------------------------------------ page */

function PricingPage() {
  const [stopId, setStopId] = useState<string>("growth");
  const [billing, setBilling] = useState<Billing>("monthly");

  const stop = STOPS.find((s) => s.id === stopId) ?? STOPS[0];
  if (!stop) return null;
  const rows = billing === "once" ? PUBLIC_ONEOFF_ENTITLEMENTS : PUBLIC_SUBSCRIPTION_ENTITLEMENTS;

  return (
    <SiteShell>
      <PublicSection className="pb-0 pt-8 sm:pb-0 sm:pt-20 lg:pb-0">
        <PublicPage>
          <h1 className="display max-w-[20ch] text-[40px] text-[color:var(--ink)] sm:text-[52px] lg:text-[60px]">
            Recruiting packages. Clear prices.
          </h1>
          <p className="mt-4 max-w-[640px] text-lg leading-[1.45] text-[color:var(--slate)] sm:mt-6 sm:text-[21px]">
            Choose your hiring capacity. See your price before you start.
          </p>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm font-semibold text-[color:var(--ink)] sm:gap-x-8 lg:grid-cols-4" aria-label="Included in every package">
            {["Your own ATS", "Sourcing agents", "Candidate outreach", "Recruiter-reviewed shortlists"].map((item) => (
              <li key={item} className="border-l-2 border-primary pl-3">{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-[color:var(--faint)]" data-testid="last-updated">
            {OFFER_LAST_UPDATED_LABEL}
          </p>
          <nav aria-label="Pricing sections" className="mt-3 flex flex-wrap gap-x-6 gap-y-0 text-sm font-semibold text-[color:var(--blue-600)] sm:mt-6 sm:gap-y-2">
            {[["packages", "Choose a package"], ["compare-costs", "Compare costs"], ["included", "What’s included"], ["terms", "Terms & questions"]].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center underline underline-offset-4">{label}</a>
            ))}
          </nav>
        </PublicPage>
      </PublicSection>

      {/* Pick billing, pick a tier */}
      <PublicSection id="packages" className="scroll-mt-24 pt-6 sm:pt-12 lg:pt-12">
        <PublicPage>
          <div className="flex flex-col items-center gap-3 text-center">
            <div role="radiogroup" aria-label="Billing" className="inline-flex rounded-full border border-[color:var(--rule-2)] bg-[color:var(--background)] p-1">
              {(
                [
                  ["monthly", "Subscription"],
                  ["once", "One-off package"],
                ] as const
              ).map(([value, text]) => (
                <RunButton
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={billing === value}
                  onClick={() => setBilling(value)}
                  className={
                    "inline-flex min-h-11 items-center rounded-full border-0 px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[color:var(--blue-600)] " +
                    (billing === value
                      ? "bg-[color:var(--ink)] text-[color:var(--white)]"
                      : "bg-transparent text-[color:var(--ink)]")
                  }
                >
                  {text}
                </RunButton>
              ))}
            </div>
            <p className="text-sm text-[color:var(--slate)]">
              {billing === "monthly" ? "Billed monthly. Cancel any month. Pay a year up front and save 10%." : "Pay once for the whole package."}
            </p>
          </div>

          <ul className="mt-10 grid gap-5 md:grid-cols-3" aria-label="Pricing tiers">
            {MAIN_TIERS.map((p) => {
              const isPilotTier = p.id === "pilot";
              const popular = p.id === "growth";
              const price = priceFor(p.id, p.capacity, p.totalUsd, billing);
              return (
                <li
                  key={p.id}
                  className={
                    "flex flex-col rounded-[var(--r-3)] border bg-[color:var(--background)] p-6 sm:p-7 " +
                    (popular ? "border-[color:var(--blue-600)] ring-1 ring-[color:var(--blue-600)]" : "border-[color:var(--rule-2)]")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-[color:var(--ink)]">{isPilotTier ? "Pilot" : p.capacityLabel}</h3>
                    {popular ? (
                      <span className="rounded-full bg-[color:var(--blue-600)] px-3 py-1 text-xs font-semibold text-[color:var(--white)]">Most popular</span>
                    ) : null}
                  </div>
                  <p className="mt-5 flex items-baseline gap-2">
                    <span className="wide num text-[44px] font-semibold leading-none text-[color:var(--ink)]">{formatUsdExact(price)}</span>
                    <span className="text-sm text-[color:var(--slate)]">{isPilotTier ? "one time" : billing === "monthly" ? "/ month" : "one total"}</span>
                  </p>
                  <p className="mt-3 text-[15px] text-[color:var(--slate)]">{TIER_BLURB[p.id]}</p>
                  <ul className="mt-5 flex flex-col gap-2 text-[15px] text-[color:var(--ink)]">
                    {[isPilotTier ? "1 role" : p.capacityLabel, "Ranked shortlist for every role", publicSeatsLine(p.id)].map((b) => (
                      <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--blue-600)]" aria-hidden />{b}</li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-7">
                    <RunLinkButton
                      to={isPilotTier ? CTA_PRIMARY.to : CTA_MESSAGE.to}
                      variant={popular ? undefined : "ghost"}
                      className="w-full justify-center"
                      onClick={() => setStopId(p.id)}
                    >
                      {isPilotTier ? CTA_PRIMARY.label : "Get started"}
                    </RunLinkButton>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border-y border-[color:var(--rule-2)] py-5 sm:py-6">
            <p className="text-sm font-semibold text-[color:var(--ink)]">Hiring more?</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-4" aria-label="Larger packages">
              {LARGER_TIERS.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start">
                  <span className="text-sm text-[color:var(--slate)]">{p.capacityLabel}</span>
                  <span className="wide num text-lg font-semibold text-[color:var(--ink)]">
                    {formatUsdExact(priceFor(p.id, p.capacity, p.totalUsd, billing))}
                    <span className="text-sm font-normal text-[color:var(--slate)]">{billing === "monthly" ? " / month" : ""}</span>
                  </span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start">
                <span className="text-sm text-[color:var(--slate)]">{ABOVE_MAX_ROLES_LABEL}</span>
                <Link to={CTA_ENTERPRISE.to} className="text-lg font-semibold text-[color:var(--blue-600)] underline underline-offset-4">Talk to us</Link>
              </li>
            </ul>
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-[color:var(--slate)]">
            {PRICING_GUARANTEES.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </PublicPage>
      </PublicSection>

      {/* Your own numbers against an agency: the difference, shown before the detail. */}
      <PublicSection id="compare-costs" className="scroll-mt-24">
        <PublicPage>
          <AgencyComparator />
        </PublicPage>
      </PublicSection>

      {/* The table follows the selector */}
      <PublicSection id="included" className="scroll-mt-24">
        <PublicPage>
          <h2 className="max-w-[20ch] text-[32px] leading-[1.08] text-[color:var(--ink)] sm:text-[44px] sm:leading-[1.04]">
            What’s included.
          </h2>
          <p className="mt-4 max-w-[640px] text-[17px] text-[color:var(--slate)]">
            The platform and managed recruiting are in every package. This is what changes:
          </p>
          <div className="mt-8">
            <EntitlementMatrix
              rows={rows}
              planIds={PUBLIC_PLAN_IDS}
              planLabels={PUBLIC_PLAN_LABELS}
              selectedPlanId={stop.id}
              caption={
                billing === "once"
                  ? "Entitlements by one-off package, from the pilot to more than 100 positions"
                  : "Entitlements by subscription package, from the pilot to more than 100 positions"
              }
            />
          </div>
        </PublicPage>
      </PublicSection>

      {/* Commercial terms: seven short answers */}
      <PhotoBand image={pricingTeam} imageAlt="A hiring team comparing recruitment plans together in a bright workspace." eyebrow="Managed execution" caption="The platform and the people behind your search." />
      <PublicSection id="terms" className="scroll-mt-24">
        <PublicPage>
          <h2 className="max-w-[20ch] text-[32px] leading-[1.08] text-[color:var(--ink)] sm:text-[44px] sm:leading-[1.04]">
            Terms & questions.
          </h2>
          <p className="mt-4 max-w-[640px] text-[17px] text-[color:var(--slate)]">
            Your signed quote or agreement is always the authority on commercial terms.
          </p>
          <div className="mt-8 divide-y divide-[color:var(--rule)] border-y border-[color:var(--rule)]">
            {ENTITLEMENT_POLICY.map((item) => (
              <details key={item.id} className="py-4">
                <summary className="min-h-11 cursor-pointer content-center text-base font-semibold text-[color:var(--ink)]">{item.question}</summary>
                <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[color:var(--slate)]">{item.answer}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-sm text-[color:var(--slate)]">Still deciding? <Link to="/faq" className="font-semibold text-[color:var(--blue-600)] underline underline-offset-4">Browse all questions</Link> or <Link to="/compare" className="font-semibold text-[color:var(--blue-600)] underline underline-offset-4">compare recruiting models</Link>.</p>
        </PublicPage>
      </PublicSection>

    </SiteShell>
  );
}
