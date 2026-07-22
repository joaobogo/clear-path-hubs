import { createFileRoute, Link } from "@tanstack/react-router";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";

const entry = getPage("pricing");

export const Route = createFileRoute("/pricing")({
  head: () =>
    marketingHead(entry, "/pricing", {
      title: "Pricing — TaaSFlow",
      description:
        "Transparent, subscription-style recruiting. Pricing is scoped to your roles and volume — submit your role or book a consultation for an exact quote.",
    }),
  component: PricingPage,
});

const INCLUDED = [
  "Guided intake and search plan",
  "Sourcing across multiple channels",
  "Evidence-based, role-specific scoring",
  "Ranked candidates delivered to your workspace",
  "Kanban pipeline with stage validation",
  "Direct messaging with the TaaSFlow team",
  "CV downloads and full candidate profiles",
  "Audit trail on every decision",
];

const EXCLUDED = [
  "Placement fees",
  "Salary-percentage commissions",
  "Long-term lock-ins",
  "Per-CV pass-through charges",
];

function PricingPage() {
  return (
    <>
      <PublicSection className="pb-8 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Pricing
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Simple model. No placement fees. Priced to your roles.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            TaaSFlow is a flat-fee, subscription-style engagement — not a percentage of salary.
            Because every search has a different scope, seniority, and volume, we quote each
            engagement directly rather than publish a static price sheet.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Get a scoped quote
            </Link>
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Book a consultation
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="grid gap-6 md:grid-cols-3">
            <ModelCard
              title="Single role"
              body="A focused engagement to fill one open position. Best for teams testing the model or hiring a single critical role."
              cta="Submit the role"
            />
            <ModelCard
              highlight
              title="Multi-role"
              body="Two to a handful of roles running in parallel. Shared intake time, one workspace, one team of the same recruiters across your searches."
              cta="Scope multiple roles"
            />
            <ModelCard
              title="Ongoing / Enterprise"
              body="Continuous hiring across teams, geographies or business units. Dedicated capacity, account structure, tailored billing and reporting."
              cta="Talk to enterprise"
              ctaTo="/enterprise"
            />
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
                Included in every engagement
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                {INCLUDED.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)] p-6 text-white sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
                What you will never be charged
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-white/85">
                {EXCLUDED.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                    {x}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-white/60">
                We publish exact figures only after they are approved for the current plan year.
              </p>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Get a quote"
        title="Tell us about the role. We will come back with a scoped price."
        description="Complete the intake or book a short consultation — no obligation."
        primary={{ to: "/intake", label: "Start intake" }}
        secondary={{ to: "/contact", label: "Book consultation" }}
      />
    </>
  );
}

function ModelCard({
  title,
  body,
  cta,
  ctaTo = "/intake",
  highlight,
}: {
  title: string;
  body: string;
  cta: string;
  ctaTo?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col rounded-2xl border p-6 sm:p-7 " +
        (highlight
          ? "border-[color:var(--brand-navy)] bg-white shadow-sm ring-1 ring-[color:var(--brand-navy)]/10"
          : "border-[color:var(--brand-navy)]/10 bg-white")
      }
    >
      <h3 className="font-[family-name:var(--brand-font-display)] text-xl font-semibold">
        {title}
      </h3>
      <p className="mt-3 flex-1 text-sm text-[color:var(--brand-navy)]/75">{body}</p>
      <Link
        to={ctaTo}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        {cta}
      </Link>
    </div>
  );
}
