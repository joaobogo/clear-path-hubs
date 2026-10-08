import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { marketingHead, faqScript, serviceScript } from "@/lib/marketing/head";
import {
  SiteShell,
  PublicPage,
  PublicSection,
} from "@/components/marketing/site-shell";
import { EditorialHero } from "@/components/marketing/editorial-hero";
import pricingHero from "@/assets/page-pricing-hero.jpg";
import { PricingTierCard } from "@/components/marketing/pricing-tier-card";
import { SubscriptionTierCard } from "@/components/marketing/subscription-tier-card";
import { AgencyComparator } from "@/components/marketing/agency-comparator";
import {
  PRICING_TIERS,
  NEVER_CHARGED,
  PRICING_GUARANTEES,
  INCLUDED_ON_EVERY_PLAN,
} from "@/content/pricing";
import { PRICING_FAQ as FAQ } from "@/content/pricing-faq";
import { SUBSCRIPTION_TIERS } from "@/content/pricing-subscriptions";
import {
  PRICE_PILOT_DISPLAY,
  ANNUAL_DISCOUNT_NOTE,
  MAX_POSITIONS,
  PACKAGE_10,
} from "@/config/pricing-core";
import { OFFER_CATEGORY, OFFER_LAST_UPDATED_LABEL, PILOT_IS_PAID_NOTE, SEATS_NOTE, TIMING_FINE_PRINT } from "@/config/offer-facts";
import { CTA_PRIMARY, CTA_MESSAGE } from "@/config/cta";
import { LargerPackagesTable } from "@/components/marketing/larger-packages-table";
import { Check, X } from "lucide-react";
import { AgencyFeeComparison } from "@/components/marketing/agency-fee-comparison";
import { RiskProof } from "@/components/marketing/risk-proof";
import { ModelComparisonTable } from "@/components/marketing/model-comparison-table";
import { CaseStudyPreviews } from "@/components/marketing/case-study-previews";
import { DecisionWorkspacePreview } from "@/components/marketing/product-preview/decision-workspace-preview";
import { EntitlementMatrix } from "@/components/marketing/entitlement-matrix";
import {
  PUBLIC_ONEOFF_ENTITLEMENTS,
  PUBLIC_SUBSCRIPTION_ENTITLEMENTS,
  PUBLIC_PLAN_IDS,
  PUBLIC_PLAN_LABELS,
  ENTITLEMENT_POLICY,
  publicSeatsLine,
} from "@/config/pricing-entitlements";
import { PAYMENTS_ENABLED } from "@/config/commerce";

export const Route = createFileRoute("/pricing")({
  head: () =>
    marketingHead(undefined, "/pricing", {
      title: `Recruiting Packages & ${PRICE_PILOT_DISPLAY} Pilot | TaaSFlow`,
      description: `Compare TaaSFlow recruiting packages, one-off and recurring options, and the ${PRICE_PILOT_DISPLAY} one-role pilot. Review scope and request a conversation.`,
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
        faqScript(FAQ),
      ],
    }),
  component: PricingPage,
});

function PricingPage() {
  const [mode, setMode] = useState<"oneoff" | "subscription">("oneoff");

  const cardTiers = PRICING_TIERS.filter((t) => t.card);
  const cardSubs = SUBSCRIPTION_TIERS.filter((t) => t.card);
  const largerOneOff = PRICING_TIERS.filter((t) => !t.card).map((t) => ({
    id: t.id,
    name: t.name,
    total: t.priceDisplay,
    billing: t.oneTime === null ? "Scoped with your account team" : "Paid once",
    seats: publicSeatsLine(t.id),
    ctaLabel: t.ctaLabel,
    ctaTo: t.ctaTo,
  }));
  const largerSubs = SUBSCRIPTION_TIERS.filter((t) => !t.card).map((t) => ({
    id: t.id,
    name: t.name,
    total: t.monthly === null ? t.priceDisplay : `${t.priceDisplay} a month`,
    billing: t.monthly === null ? "Scoped with your account team" : "Billed monthly",
    seats: publicSeatsLine(t.id),
    ctaLabel: t.ctaLabel,
    ctaTo: t.ctaTo,
  }));

  return (
    <SiteShell>
      <EditorialHero
        eyebrow="Pricing"
        title={`Flat-fee recruiting. ${PRICE_PILOT_DISPLAY} for your first role.`}
        lead={`Every package is the full ${OFFER_CATEGORY.toLowerCase()}. What changes is capacity: positions, seats and support.`}
        image={pricingHero}
        imageAlt="A hiring team planning roles together in a light-filled meeting room"
        stats={[
          { value: PRICE_PILOT_DISPLAY, label: "One-role pilot, paid once" },
          { value: "0%", label: "Placement fee on any package" },
          { value: String(MAX_POSITIONS), label: "Positions in the largest published package" },
        ]}
        primary={CTA_PRIMARY}
        secondary={CTA_MESSAGE}
      >
        <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-[color:var(--brand-navy)]/80">
          {[
            "No salary percentage fees",
            "Evidence-backed scoring on every candidate",
            "A recruiter reviews every shortlist",
            "Export your candidate records at any time",
          ].map((x) => (
            <li key={x} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
              {x}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[color:var(--brand-navy)]/70" data-testid="last-updated">
          {OFFER_LAST_UPDATED_LABEL}
        </p>
      </EditorialHero>

      {/* One-off vs recurring selector */}
      <PublicSection className="pt-4">
        <PublicPage>
          <div
            role="tablist"
            aria-label="Billing model"
            className="mx-auto inline-flex w-full max-w-md items-center rounded-full border border-[color:var(--brand-navy)]/12 bg-white p-1 sm:flex"
          >
            {(
              [
                ["oneoff", "One-off package"],
                ["subscription", "Monthly subscription"],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={
                  "flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors min-h-11 sm:min-h-0 sm:py-2 " +
                  (mode === value
                    ? "bg-[color:var(--brand-navy)] text-white shadow-sm"
                    : "text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]")
                }
              >
                {text}
              </button>
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-[color:var(--brand-navy)]/80">
            {mode === "oneoff"
              ? "A single flat fee, paid once, for a fixed number of positions. Best when you know which roles are open now."
              : "The same packages and totals, charged each month. Best when hiring is continuous."}
          </p>
        </PublicPage>
      </PublicSection>

      <PublicSection className="pt-6">
        <PublicPage>
          <p className="mb-6 max-w-3xl text-sm text-[color:var(--brand-navy)]/85">
            The pilot is one role, once per company. The smallest package covers up to{" "}
            {PACKAGE_10.capacity} positions for one total, so packages suit teams hiring for
            several roles. {PILOT_IS_PAID_NOTE}
          </p>
          {mode === "oneoff" ? (
            <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {cardTiers.map((tier) => (
                <PricingTierCard key={tier.id} tier={tier} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {cardSubs.map((tier) => (
                  <SubscriptionTierCard key={tier.id} tier={tier} />
                ))}
              </div>
              <p className="mt-6 text-sm text-[color:var(--brand-navy)]/80">
                <span className="font-semibold text-[color:var(--brand-navy)]">
                  {ANNUAL_DISCOUNT_NOTE}
                </span>{" "}
                {PAYMENTS_ENABLED
                  ? "The total you see is the total charged at checkout."
                  : "The total you see is the total on your invoice."}
              </p>
            </>
          )}

          <h2 className="mt-10 font-[family-name:var(--brand-font-display)] text-xl font-semibold tracking-tight">
            Larger packages
          </h2>
          <p className="mb-4 mt-1 text-sm text-[color:var(--brand-navy)]/80">
            Same platform, more positions. Every package and its total is also in the comparison
            table below.
          </p>
          <LargerPackagesTable
            rows={mode === "oneoff" ? largerOneOff : largerSubs}
            caption={
              mode === "oneoff"
                ? "Larger one-off packages: total, billing, seats and next step"
                : "Larger subscription packages: monthly total, billing, seats and next step"
            }
          />

          <p className="mt-6 text-sm text-[color:var(--brand-navy)]/80">
            {TIMING_FINE_PRINT} {SEATS_NOTE}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[color:var(--brand-navy)]/80">
            {PRICING_GUARANTEES.map((g) => (
              <span key={g} className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-[color:var(--brand-navy)]" aria-hidden />
                {g}
              </span>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Entitlement comparison — platform capacity per plan */}
      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
            What each plan entitles you to
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--brand-navy)]/80">
            The platform is the same on every plan. These are the entitlements that
            differ: capacity, seats and support. Where a cell says &ldquo;Scoped with your
            account team&rdquo;, we set it with you rather than print a limit we have not committed to.
          </p>
          <div className="mt-6">
            <EntitlementMatrix
              rows={mode === "oneoff" ? PUBLIC_ONEOFF_ENTITLEMENTS : PUBLIC_SUBSCRIPTION_ENTITLEMENTS}
              planIds={PUBLIC_PLAN_IDS}
              planLabels={PUBLIC_PLAN_LABELS}
              caption={
                mode === "oneoff"
                  ? "Entitlements by one-off package, from the pilot to more than 100 positions"
                  : "Entitlements by subscription package, from the pilot to more than 100 positions"
              }
            />
          </div>
        </PublicPage>
      </PublicSection>

      {/* Entitlement rules — active roles, limits, billing, upgrades, retention */}
      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
            How our commercial options work.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--brand-navy)]/80">
            Plain answers to the questions that decide whether a plan fits. Your
            signed quote or agreement is always the authority on commercial terms.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {ENTITLEMENT_POLICY.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 sm:p-6"
              >
                <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>



      {/* Static agency-fee comparison — example math for 1, 3, 10 hires */}
      <PublicSection className="py-10">
        <PublicPage>
          <AgencyFeeComparison />
        </PublicPage>
      </PublicSection>

      {/* Operating-model comparison — agency vs sourcing tools vs TaaSFlow */}
      <PublicSection className="py-10">
        <PublicPage>
          <ModelComparisonTable />
        </PublicPage>
      </PublicSection>


      {/* Live agency comparator */}
      <PublicSection className="py-10">
        <PublicPage>
          <AgencyComparator />
        </PublicPage>
      </PublicSection>

      {/* What the subscription actually gives you */}
      <PublicSection className="py-10">
        <PublicPage>
          <div className="max-w-2xl">
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              What you actually get access to.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              Every plan opens the same Decision Workspace. Plans differ in seats,
              concurrent roles and entitlements — not in the product.
            </p>
          </div>
          <div className="mt-8 max-w-3xl">
            <DecisionWorkspacePreview />
          </div>
        </PublicPage>
      </PublicSection>

      {/* Example engagements */}
      <PublicSection className="py-10">
        <PublicPage>
          <CaseStudyPreviews
            count={2}
            title="Example engagements by industry"
            intro="Anonymised examples by industry and company type. Your own search depends on the role and the market."
          />
        </PublicPage>
      </PublicSection>

      {/* Proof that lowers hiring risk */}
      <PublicSection className="py-10">
        <PublicPage>
          <RiskProof />
        </PublicPage>
      </PublicSection>


      {/* Never charged */}
      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
                Included on every plan
              </h2>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
                Baseline platform capabilities, regardless of plan size.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-[color:var(--brand-navy)]/85">
                {INCLUDED_ON_EVERY_PLAN.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-cream)] p-6 sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
                What you will never be charged
              </h2>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
                Charges you will never see on a TaaSFlow invoice.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-[color:var(--brand-navy)]/85">
                {NEVER_CHARGED.map((x) => (
                  <li key={x} className="flex gap-2">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/80" aria-hidden />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* FAQ */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Pricing FAQ
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            The questions we get before a first engagement.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-4">
                  <span className="font-semibold text-[color:var(--brand-navy)]">{f.q}</span>
                  <span
                    aria-hidden
                    className="mt-0.5 text-[color:var(--brand-navy)]/80 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </PublicPage>
      </PublicSection>
      <PublicSection className="py-10">
        <PublicPage>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={CTA_PRIMARY.to}
              className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              {CTA_PRIMARY.label}
            </Link>
            <Link
              to={CTA_MESSAGE.to}
              className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              {CTA_MESSAGE.label}
            </Link>
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
