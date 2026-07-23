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
import { PRICING_TIERS, NEVER_CHARGED } from "@/content/pricing";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () =>
    marketingHead(undefined, "/pricing", {
      title: "Pricing — TaaSFlow subscription recruiting",
      description:
        "Flat-fee subscription recruiting. Transparent tiers, no placement fees, no salary-percentage commissions. Compare directly against a traditional agency invoice.",
    }),
  component: PricingPage,
});

function PricingPage() {
  const paid = PRICING_TIERS.filter((t) => t.id !== "enterprise");
  const enterprise = PRICING_TIERS.find((t) => t.id === "enterprise")!;

  return (
    <SiteShell>
      {/* Hero */}
      <PublicSection className="pb-6 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Pricing
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            One flat subscription. Zero placement fees.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            You pay for the recruiting work, not a share of the salary. Every
            tier includes ranked candidates with evidence, live workspace
            visibility, and full pipeline ownership.
          </p>
          <ul className="mt-6 grid gap-3 text-sm text-[color:var(--brand-navy)]/75 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Flat subscription — no placement fees",
              "Ranked candidates every week",
              "Live workspace visibility",
              "You own pipeline and decisions",
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

      {/* Three tier cards — progressive disclosure inside each */}
      <PublicSection className="pt-4">
        <PublicPage>
          <div className="grid gap-5 md:grid-cols-3">
            {paid.map((tier) => (
              <PricingTierCard key={tier.id} tier={tier} />
            ))}
          </div>
          <p className="mt-4 text-xs text-[color:var(--brand-navy)]/55">
            Prices shown are indicative starting points. The contractual price
            is confirmed on your scoped quote once the intake is complete.
          </p>
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
