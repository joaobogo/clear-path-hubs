import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { marketingHead } from "@/lib/marketing/head";
import { PRODUCT_CATEGORY } from "@/config/product-language";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { PricingTierCard } from "@/components/marketing/pricing-tier-card";
import { SubscriptionTierCard } from "@/components/marketing/subscription-tier-card";
import { AgencyComparator } from "@/components/marketing/agency-comparator";
import { PRICING_TIERS, NEVER_CHARGED, PRICING_GUARANTEES } from "@/content/pricing";
import { SUBSCRIPTION_TIERS } from "@/content/pricing-subscriptions";
import {
  PRICE_PILOT_DISPLAY,
  SUBSCRIPTION_ANNUAL_DISCOUNT_LABEL,
} from "@/config/pricing-core";
import { Check, X } from "lucide-react";
import { PageConnections } from "@/components/marketing/page-connections";
import { AgencyFeeComparison } from "@/components/marketing/agency-fee-comparison";
import { RiskProof } from "@/components/marketing/risk-proof";
import { ModelComparisonTable } from "@/components/marketing/model-comparison-table";
import { CaseStudyPreviews } from "@/components/marketing/case-study-previews";
import { DecisionWorkspacePreview } from "@/components/marketing/product-preview/decision-workspace-preview";
import { EcosystemCrossSell } from "@/components/marketing/ecosystem-cross-sell";
import { EntitlementMatrix } from "@/components/marketing/entitlement-matrix";
import {
  ONEOFF_ENTITLEMENTS,
  ONEOFF_PLAN_IDS,
  ONEOFF_PLAN_LABELS,
  SUBSCRIPTION_ENTITLEMENTS,
  SUBSCRIPTION_PLAN_IDS,
  SUBSCRIPTION_PLAN_LABELS,
  ENTITLEMENT_POLICY,
} from "@/config/pricing-entitlements";

export const Route = createFileRoute("/pricing")({
  head: () =>
    marketingHead(undefined, "/pricing", {
      title: "Pricing & Plan Entitlements | TaaSFlow Platform",
      description:
        `TaaSFlow platform plans from ${PRICE_PILOT_DISPLAY}: active roles under management, agent capacity, Hiring Intelligence, Evidence Graph, governance and support — compared side by side.`,
    }),
  component: PricingPage,
});

function PricingPage() {
  const paid = PRICING_TIERS.filter((t) => t.id !== "enterprise");
  const [mode, setMode] = useState<"oneoff" | "subscription">("oneoff");

  return (
    <SiteShell>
      {/* Hero — mirrors taasflow.com/pricing */}
      <PublicSection className="pb-6 pt-16 sm:pt-20">
        <PublicPage>
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              Plans & Entitlements
            </p>
            <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
              One platform. Entitlements that scale.
            </h1>
            <p className="mt-5 max-w-2xl mx-auto text-lg text-[color:var(--brand-navy)]/80">
              Every plan is the full {PRODUCT_CATEGORY}. What changes between
              plans is capacity — active roles, agent runs, intelligence and
              governance. One-off packages are billed once; subscription
              programmes are billed monthly.
            </p>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-[color:var(--brand-navy)]/80">
            {[
              "No salary percentage fees",
              "Evidence-backed scoring on every candidate",
              "Expert oversight included in every plan",
              "Candidate records stay yours",
            ].map((x) => (
              <li key={x} className="flex items-start gap-2">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]"
                  aria-hidden
                />
                {x}
              </li>
            ))}
          </ul>
        </PublicPage>
      </PublicSection>

      {/* Tab toggle — One-Off Package / Subscription (mirrors taasflow.com) */}
      <PublicSection className="pt-4">
        <PublicPage>
          <div
            role="tablist"
            aria-label="Billing model"
            className="mx-auto inline-flex w-full max-w-md items-center rounded-full border border-[color:var(--brand-navy)]/12 bg-white p-1 sm:mx-0 sm:mx-auto sm:flex"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "oneoff"}
              onClick={() => setMode("oneoff")}
              className={
                "flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors min-h-11 sm:min-h-0 sm:py-2 " +
                (mode === "oneoff"
                  ? "bg-[color:var(--brand-navy)] text-white shadow-sm"
                  : "text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]")
              }
            >
              One-Off Package
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "subscription"}
              onClick={() => setMode("subscription")}
              className={
                "flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors min-h-11 sm:min-h-0 sm:py-2 " +
                (mode === "subscription"
                  ? "bg-[color:var(--brand-navy)] text-white shadow-sm"
                  : "text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]")
              }
            >
              Subscription
            </button>
          </div>
          <p className="mt-4 text-center text-sm text-[color:var(--brand-navy)]/80">
            {mode === "oneoff"
              ? "A single flat fee for a fixed set of active roles. Best when you know exactly which roles are open now."
              : "Continuous capacity, billed monthly — Bronze through Enterprise."}
          </p>
        </PublicPage>
      </PublicSection>

      {/* Tier cards — swap based on mode */}
      <PublicSection className="pt-6">
        <PublicPage>
          {mode === "oneoff" ? (
            <>
              <div className="grid gap-5 md:grid-cols-3">
                {paid.map((tier) => (
                  <PricingTierCard key={tier.id} tier={tier} />
                ))}
              </div>
              <p className="mt-6 text-sm text-[color:var(--brand-navy)]/80">
                Each active role returns a ranked, evidence-backed shortlist of the{" "}
                <span className="font-semibold text-[color:var(--brand-navy)]">top 10</span>{" "}
                candidates, refreshed weekly in your workspace.
              </p>
            </>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {SUBSCRIPTION_TIERS.map((tier) => (
                  <SubscriptionTierCard key={tier.id} tier={tier} />
                ))}
              </div>
              {/* Annual discount applies to subscription programmes only — never
                  to the one-off packages above. */}
              <p className="mt-6 text-sm text-[color:var(--brand-navy)]/80">
                <span className="font-semibold text-[color:var(--brand-navy)]">
                  {SUBSCRIPTION_ANNUAL_DISCOUNT_LABEL}
                </span>{" "}
                — applied at subscription checkout or on your invoice. Monthly
                prices are shown above.
              </p>
            </>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[color:var(--brand-navy)]/80">
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
            differ — capacity, access and governance, not hours of labour.
          </p>
          <div className="mt-6">
            {mode === "oneoff" ? (
              <EntitlementMatrix
                rows={ONEOFF_ENTITLEMENTS}
                planIds={ONEOFF_PLAN_IDS}
                planLabels={ONEOFF_PLAN_LABELS}
                caption="Platform entitlements by one-off package plan"
              />
            ) : (
              <EntitlementMatrix
                rows={SUBSCRIPTION_ENTITLEMENTS}
                planIds={SUBSCRIPTION_PLAN_IDS}
                planLabels={SUBSCRIPTION_PLAN_LABELS}
                caption="Platform entitlements by subscription plan"
              />
            )}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Entitlement rules — active roles, limits, billing, upgrades, retention */}
      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
            How the entitlements work
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

      {/* Real engagements */}
      <PublicSection className="py-10">
        <PublicPage>
          <CaseStudyPreviews count={2} />
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
                {PRICING_TIERS[0].included.map((x) => (
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

      <CtaSection
        eyebrow="Get a scoped quote"
        title="Tell us about the role. We come back with an exact price."
        description="Complete the guided intake or book a short call — no obligation, no placement fees, no lock-in on the conversation."
        primary={{ to: "/intake", label: "Start Hiring" }}
        secondary={{ to: "/contact", label: "Contact Sales" }}
      />
          <PageConnections
        commercial={{ to: "/intake", label: "Start hiring", desc: "Pick a plan and open your first role." }}
        explainer={{ to: "/how-it-works", label: "How delivery works", desc: "What each subscription actually includes each week." }}
        resource={{ to: "/faq", label: "Pricing questions answered", desc: "Overages, holds, cancellation, and enterprise terms." }}
        audience={{ to: "/enterprise", label: "Enterprise pricing", desc: "Volume, procurement, and MSA-ready terms." }}
      />
      <EcosystemCrossSell trigger="single-role" />
    </SiteShell>
  );
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does subscription recruiting differ from an agency?",
    a: "An agency charges a percentage of first-year salary once a candidate is placed. TaaSFlow charges a flat monthly fee for the search itself — the Agent Layer, the sourcing, the evaluation, the Decision Workspace. Every candidate the platform surfaces stays in your workspace whether they get hired or not.",
  },
  {
    q: "Do prices go up if we hire multiple candidates?",
    a: "No. The monthly fee covers the search capacity, not the outcome. Hire one, hire three, hire none — the invoice is the same. Your incentive to run a rigorous process is not fighting our incentive to close.",
  },
  {
    q: "Can we pause the subscription between roles?",
    a: "Yes. Engagements can be paused with notice and resumed when the next roles are ready. Your workspace, candidates, and evidence stay in place while paused.",
  },
  {
    q: "What if we outgrow a tier mid-engagement?",
    a: "Move up at the next billing cycle — the intake context, workspace, and reusable pipeline carry over. Downgrades work the same way.",
  },
  {
    q: "Is there a contract minimum?",
    a: "The Bronze and Silver subscriptions run month-to-month. Gold and Enterprise have quarterly minimums to align agent capacity planning with your programme. One-off packages have no minimum at all. Exact terms are on your scoped quote.",
  },
  {
    q: "How does the pilot work?",
    a: "The Pilot itself is the pilot: one active role, no long commitment, full workflow. If it fits, keep going or move up. If it doesn't, walk away with every candidate the platform surfaced.",
  },
];
