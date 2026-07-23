import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/about")({
  head: () =>
    marketingHead(undefined, "/about", {
      title: "About TaaSFlow — operators rebuilding recruiting",
      description:
        "TaaSFlow was founded by operators who lived the pain of traditional agency recruiting. We rebuilt the model around evidence, transparency and client ownership.",
    }),
  component: AboutPage,
});

const BROKEN = [
  {
    title: "Opaque shortlists",
    body: "Agencies deliver a name and a summary. Buyers cannot see why a candidate is on the list — or who was rejected and why.",
  },
  {
    title: "Contingent incentives",
    body: "Placement fees push volume over fit. The incentive is to close, not to build a durable hiring engine.",
  },
  {
    title: "Fragmented pipelines",
    body: "Multiple vendors, spreadsheets, and inboxes. There is no single source of truth on any given role.",
  },
  {
    title: "Candidates left in silence",
    body: "Most applicants never hear back. Talent brand and repeat pipeline suffer as a result.",
  },
];

const CHANGES = [
  {
    title: "Evidence-first scoring",
    body: "Every candidate is scored against a role-specific rubric with the exact CV evidence attached. If we cannot cite it, we do not claim it.",
  },
  {
    title: "One transparent workspace",
    body: "Clients see the same ranked shortlist, evidence and recruiter notes we do. Nothing lives in a private inbox.",
  },
  {
    title: "Subscription-aligned incentives",
    body: "A flat fee decouples our revenue from placement pressure and aligns us with your long-term hiring outcomes.",
  },
  {
    title: "Candidates treated as people",
    body: "Applicants get status, feedback and a real answer. Silence is not a delivery mode.",
  },
];

const VALUES = [
  { title: "Evidence over opinion", body: "Rubrics, citations, and reviewed shortlists — not vibes." },
  { title: "Transparency by default", body: "If the client cannot see it, we should not be doing it." },
  { title: "Own your pipeline", body: "You keep every candidate we source. No gatekeeping, no lock-in." },
  { title: "Respect the candidate", body: "Real answers, real feedback, real timelines." },
  { title: "Operator discipline", body: "We build the system we would want as hiring managers." },
  { title: "Boring reliability", body: "Cadence, ownership, and clarity beat heroics." },
];

const SERVES = [
  {
    who: "Founders and heads of talent",
    body: "Scaling teams that need predictable throughput without hiring an internal recruiting org overnight.",
  },
  {
    who: "Enterprise talent leaders",
    body: "Programmes across multiple business units that need one operating model and one aggregated view.",
  },
  {
    who: "Operators leading a hire personally",
    body: "Founders and executives who want to run the search themselves without losing their week to sourcing.",
  },
];

function AboutPage() {
  return (
    <SiteShell>
      {/* Purpose */}
      <PublicSection className="pt-24">
        <PublicPage className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            About TaaSFlow
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            We exist to make recruiting explainable again.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            TaaSFlow is a subscription recruiting model built by operators. Our
            purpose is simple: give hiring teams a system where every
            shortlist, every score and every decision can be traced to the
            evidence behind it.
          </p>
        </PublicPage>
      </PublicSection>

      {/* Why TaaSFlow was created */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-16">
        <PublicPage className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              Why TaaSFlow was created
            </h2>
            <p className="mt-4 text-[color:var(--brand-navy)]/70">
              We kept hitting the same wall in-house: agency partners returned
              opaque shortlists, RPO added process without improving quality,
              and the actual signal we needed — why a candidate might be
              great — sat locked inside a recruiter's head.
            </p>
            <p className="mt-4 text-[color:var(--brand-navy)]/70">
              We wanted a model where the rubric was written down, the
              evidence lived next to the score, and the workspace was the
              same one the client used. So we built it.
            </p>
          </div>
          <blockquote className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
            <p className="text-lg text-[color:var(--brand-navy)] sm:text-xl">
              "As operators we spent years accepting shortlists we could not
              explain. TaaSFlow is the recruiting system we always wanted on
              the buying side — one workspace, one rubric, one story per
              candidate."
            </p>
            <footer className="mt-6 text-sm text-[color:var(--brand-navy)]/60">
              — TaaSFlow founding team
            </footer>
          </blockquote>
        </PublicPage>
      </PublicSection>

      {/* What is broken */}
      <PublicSection>
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            What is broken in traditional recruiting
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {BROKEN.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                  {b.title}
                </h3>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70">
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* What TaaSFlow changes */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)] py-20 text-white">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            What TaaSFlow changes
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {CHANGES.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-white/15 bg-white/5 p-6"
              >
                <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-3 text-sm text-white/75">{c.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Values */}
      <PublicSection>
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Company values
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                  {v.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Who we serve */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <h2 className="max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Who TaaSFlow serves
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {SERVES.map((s) => (
              <div
                key={s.who}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                  {s.who}
                </h3>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Link to Journey */}
      <PublicSection>
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-8 sm:p-12">
            <div className="grid gap-6 md:grid-cols-[2fr_1fr] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
                  Continue reading
                </p>
                <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
                  The story behind the model
                </h2>
                <p className="mt-3 max-w-xl text-[color:var(--brand-navy)]/70">
                  Our journey page walks through the operator insight that led
                  to TaaSFlow, and how the model evolved into the workspace
                  clients use today.
                </p>
              </div>
              <div className="md:justify-self-end">
                <Link
                  to="/journey"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy)]/90"
                >
                  Explore our journey
                </Link>
              </div>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Final CTA */}
      <CtaSection
        eyebrow="Ready when you are"
        title="Start hiring with an evidence-first model."
        description="Submit a role in the guided intake — your workspace is ready as soon as you finish."
        primary={{ to: "/journey", label: "Explore our journey" }}
        secondary={{ to: "/intake", label: "Start hiring" }}
      />
    </SiteShell>
  );
}
