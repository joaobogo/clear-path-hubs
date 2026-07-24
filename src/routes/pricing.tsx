import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { PricingTierCard } from "@/components/marketing/pricing-tier-card";
import { AgencyComparator } from "@/components/marketing/agency-comparator";
import { PRICING_TIERS, NEVER_CHARGED, PRICING_GUARANTEES } from "@/content/pricing";
import { Check, X } from "lucide-react";
import { PageConnections } from "@/components/marketing/page-connections";

export const Route = createFileRoute("/pricing")({
  head: () =>
    marketingHead(undefined, "/pricing", {
      title: "Pricing — Plans that scale with volume | TaaSFlow",
      description:
        `Transparent one-off packages from ${PRICE_PILOT_DISPLAY}. Ranked candidates in 14 days, no placement fees, no salary percentages. Higher volume = lower cost per role.`,
    }),
  component: PricingPage,
});

function PricingPage() {
  const paid = PRICING_TIERS.filter((t) => t.id !== "enterprise");
  const enterprise = PRICING_TIERS.find((t) => t.id === "enterprise")!;

  return (
    <SiteShell>
      {/* Hero — mirrors taasflow.com/pricing */}
      <PublicSection className="pb-6 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Transparent Pricing
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Plans that scale with volume.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            Higher volume = lower cost per role. Annual commitment saves 10%.
          </p>
          <ul className="mt-6 grid gap-3 text-sm text-[color:var(--brand-navy)]/75 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "No salary percentage fees",
              "Ranked candidates in 14 days",
              "Ethical, criteria-based scoring",
              "You keep the candidates forever",
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

      {/* Three tier cards */}
      <PublicSection className="pt-4">
        <PublicPage>
          <div className="grid gap-5 md:grid-cols-3">
            {paid.map((tier) => (
              <PricingTierCard key={tier.id} tier={tier} />
            ))}
          </div>
          <p className="mt-6 text-sm text-[color:var(--brand-navy)]/70">
            Deliveries include the <span className="font-semibold text-[color:var(--brand-navy)]">top 10</span> ranked candidates per position each week.
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


      {/* Enterprise strip */}
      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-6 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)] p-6 text-white sm:p-10 md:grid-cols-[2fr_1fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                {enterprise.eyebrow}
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                {enterprise.name}
              </h2>
              <p className="mt-3 max-w-xl text-white/80">{enterprise.bestFor}</p>
              <ul className="mt-5 grid gap-2 text-sm text-white/85 sm:grid-cols-2">
                {enterprise.included.slice(0, 6).map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/80" aria-hidden />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:justify-self-end">
              <Link
                to={enterprise.ctaTo}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:opacity-90"
              >
                {enterprise.ctaLabel}
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Live agency comparator */}
      <PublicSection className="py-10">
        <PublicPage>
          <AgencyComparator />
        </PublicPage>
      </PublicSection>

      {/* Never charged */}
      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
                What every tier includes
              </h2>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                Baseline capabilities that ship on every engagement.
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
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                Charges you will never see on a TaaSFlow invoice.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-[color:var(--brand-navy)]/85">
                {NEVER_CHARGED.map((x) => (
                  <li key={x} className="flex gap-2">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/70" aria-hidden />
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Pricing FAQ
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            The questions we get before a first engagement.
          </h2>
          <dl className="mt-8 grid gap-6 md:grid-cols-2">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-4">
                  <dt className="font-semibold text-[color:var(--brand-navy)]">{f.q}</dt>
                  <span
                    aria-hidden
                    className="mt-0.5 text-[color:var(--brand-navy)]/50 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <dd className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                  {f.a}
                </dd>
              </details>
            ))}
          </dl>
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
    </SiteShell>
  );
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does subscription recruiting differ from an agency?",
    a: "An agency charges a percentage of first-year salary once a candidate is placed. TaaSFlow charges a flat monthly fee for the search itself — the recruiters, the sourcing, the evaluation, the workspace. Every candidate we source stays in your workspace whether they get hired or not.",
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
    a: "The Starter and Growth tiers run month-to-month. Scale and Enterprise have quarterly minimums to align the pod's capacity planning with your programme. Exact terms are on your scoped quote.",
  },
  {
    q: "How does the pilot work?",
    a: "The Starter tier itself is the pilot: one active role, no long commitment, full workflow. If it fits, keep going or move up. If it doesn't, walk away with every candidate we sourced.",
  },
];
