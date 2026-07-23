import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { IndustryGallery } from "@/components/marketing/industry-gallery";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/industries/")({
  head: () =>
    marketingHead(undefined, "/industries", {
      title: "Industries we serve — TaaSFlow",
      description:
        "Structured, evidence-based subscription recruiting across 57 industries. Interactive explorer: search roles, skills and certifications — every industry has a dedicated page.",
    }),
  component: IndustriesIndex,
});

const CONTEXT_REASONS = [
  {
    title: "Signal lives in the domain",
    body: "A CS manager at a self-serve SaaS is a different job to one at an enterprise platform. Domain context turns identical titles into a real rubric.",
  },
  {
    title: "Language and evidence differ",
    body: "Engineers describe systems, lawyers describe matters, clinicians describe caseloads. We extract evidence in the vocabulary of the role.",
  },
  {
    title: "Regulation and constraints matter",
    body: "Jurisdictions, licences, and framework fit change who qualifies. We treat them as first-class filters, not free-text notes.",
  },
];

function IndustriesIndex() {
  return (
    <SiteShell>
      {/* Hero */}
      <PublicSection className="pt-24">
        <PublicPage className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            Industry explorer
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            One recruiting model. Every industry, its own rubric.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            Pick a category, search for a role, skill or certification. Every
            industry has a dedicated page with the rubric approach, common
            roles and how the workspace is set up.
          </p>
        </PublicPage>
      </PublicSection>

      {/* Explorer */}
      <PublicSection>
        <PublicPage>
          <IndustryExplorer />
        </PublicPage>
      </PublicSection>

      {/* Why context matters */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-16">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Why industry context matters in recruiting
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {CONTEXT_REASONS.map((r) => (
              <div
                key={r.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                  {r.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/70">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Enterprise CTA */}
      <PublicSection>
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-8 sm:p-12">
            <div className="grid gap-8 md:grid-cols-[2fr_1fr] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
                  For enterprise teams
                </p>
                <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
                  Hiring across multiple industries at once?
                </h2>
                <p className="mt-3 max-w-xl text-[color:var(--brand-navy)]/70">
                  We run cross-industry programmes for enterprise account
                  structures — one workspace per business unit, one rubric per
                  role, aggregate reporting on top.
                </p>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <Link
                  to="/enterprise"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy)]/90"
                >
                  See the enterprise model
                </Link>
                <Link
                  to="/contact"
                  className="text-sm font-semibold text-[color:var(--brand-ocean)] hover:underline"
                >
                  Book enterprise consultation →
                </Link>
              </div>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Final CTA */}
      <CtaSection
        eyebrow="Ready to hire?"
        title="Pick your industry. Start the intake."
        description="Submit a role and your workspace is ready when you finish the guided intake."
        primary={{ to: "/intake", label: "Start hiring" }}
        secondary={{ to: "/how-it-works", label: "See how it works" }}
      />
    </SiteShell>
  );
}
