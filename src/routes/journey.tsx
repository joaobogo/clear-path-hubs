import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { PageConnections } from "@/components/marketing/page-connections";

export const Route = createFileRoute("/journey")({
  head: () =>
    marketingHead(undefined, "/journey", {
      title: "Our journey — how TaaSFlow rebuilt recruiting | TaaSFlow",
      description:
        "The story behind TaaSFlow — from the operator insight that agencies were the wrong model, to a structured recruiting workspace with ranked, evidence-backed candidates.",
    }),
  component: JourneyPage,
});

/* ------------------------------------------------------------- Mock UI --- */

function MockChrome({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--brand-navy)]/10 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/60 px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-navy)]/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-navy)]/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--brand-navy)]/15" />
        <span className="ml-3 truncate text-xs font-medium text-[color:var(--brand-navy)]/80">
          {title}
        </span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function RankedShortlistMock() {
  const rows = [
    { rank: 1, name: "Candidate A", score: 92, cite: "Owned Kubernetes platform for 40+ services" },
    { rank: 2, name: "Candidate B", score: 88, cite: "Led migration from monolith to event-driven" },
    { rank: 3, name: "Candidate C", score: 84, cite: "Managed on-call rotation, 99.95% uptime" },
    { rank: 4, name: "Candidate D", score: 79, cite: "Rebuilt CI pipeline, deploys 5× faster" },
  ];
  return (
    <MockChrome title="Requisition · Ranked shortlist">
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.rank}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2.5"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--brand-navy)] text-xs font-semibold text-white">
              {r.rank}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                {r.name}
              </p>
              <p className="truncate text-xs text-[color:var(--brand-navy)]/80">
                Evidence: {r.cite}
              </p>
            </div>
            <span className="rounded-full bg-[color:var(--brand-ocean)]/10 px-2.5 py-0.5 text-xs font-semibold text-[color:var(--brand-ocean-text)]">
              {r.score}
            </span>
          </div>
        ))}
      </div>
    </MockChrome>
  );
}

function EvidenceMock() {
  return (
    <MockChrome title="Candidate · Evidence panel">
      <div className="space-y-3">
        {[
          { req: "Kubernetes at scale", cite: "'Owned production K8s across 3 regions, 40+ services'" },
          { req: "SRE on-call ownership", cite: "'Led on-call rotation, cut incident MTTR by 45%'" },
          { req: "Team leadership", cite: "'Managed a 6-engineer platform team for 2 years'" },
        ].map((e) => (
          <div
            key={e.req}
            className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
              {e.req}
            </p>
            <p className="mt-1 text-sm text-[color:var(--brand-navy)]/80">
              {e.cite}
            </p>
          </div>
        ))}
      </div>
    </MockChrome>
  );
}

function WorkspaceMock() {
  return (
    <MockChrome title="Client workspace · Overview">
      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "Active", v: "5" },
          { l: "Shortlisted", v: "12" },
          { l: "In interview", v: "4" },
        ].map((k) => (
          <div
            key={k.l}
            className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-3 text-center"
          >
            <p className="text-2xl font-semibold text-[color:var(--brand-navy)]">
              {k.v}
            </p>
            <p className="mt-1 text-xs text-[color:var(--brand-navy)]/80">
              {k.l}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {["Senior SRE — new evidence added", "Product Manager — shortlist published", "Data Engineer — interview scheduled"].map(
          (s) => (
            <div
              key={s}
              className="flex items-center justify-between rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2 text-sm text-[color:var(--brand-navy)]/80"
            >
              <span className="truncate">{s}</span>
              <span className="ml-3 text-xs text-[color:var(--brand-navy)]/80">
                today
              </span>
            </div>
          ),
        )}
      </div>
    </MockChrome>
  );
}

function DecisionMock() {
  return (
    <MockChrome title="Client actions · Decision">
      <div className="flex flex-wrap gap-2">
        {["Advance", "Request interview", "Hold", "Pass — reason"].map((a) => (
          <span
            key={a}
            className="inline-flex items-center rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-3 py-1 text-xs font-medium text-[color:var(--brand-navy)]"
          >
            {a}
          </span>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
          Audit trail
        </p>
        <ul className="mt-2 space-y-1 text-xs text-[color:var(--brand-navy)]/80">
          <li>· Advanced Candidate A · Head of Engineering</li>
          <li>· Requested interview · Talent Ops</li>
          <li>· Pass — reason: seniority mismatch · Head of Engineering</li>
        </ul>
      </div>
    </MockChrome>
  );
}

/* --------------------------------------------------------------- Sections */

const CHAPTERS = [
  {
    n: "01",
    label: "What was broken",
    title: "Hiring had no shared surface.",
    body: "As operators we lived it: agencies delivered names without reasoning, RPO added process without improving quality, and every search felt like a fresh set of spreadsheets. There was no shared surface where the rubric, the evidence, and the decisions lived together.",
  },
  {
    n: "02",
    label: "Why agencies failed",
    title: "Incentives were pointed at the wrong outcome.",
    body: "Contingent fees rewarded speed to placement, not quality of match. Recruiters had every reason to push a candidate over the line and no reason to explain why. Clients paid five figures per hire and still had to trust a summary paragraph.",
  },
  {
    n: "03",
    label: "What TaaSFlow changed",
    title: "A recruiting function, delivered as product.",
    body: "Instead of contingent fees, a subscription. Instead of a private inbox, a per-requisition workspace. Instead of a summary paragraph, a rubric with citations. The model is boring on purpose — cadence and clarity beat heroics.",
  },
];

function JourneyPage() {
  return (
    <SiteShell>
      {/* Hero */}
      <PublicSection className="pt-24">
        <PublicPage className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
            Our journey
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            How TaaSFlow became a better recruiting model.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            TaaSFlow was not built to be another agency with a nicer landing
            page. It was built to fix the specific things that failed us
            every time we tried to hire at scale.
          </p>
        </PublicPage>
      </PublicSection>

      {/* Chapters 1-3 */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <div className="space-y-14">
            {CHAPTERS.map((c) => (
              <article
                key={c.n}
                className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-10"
              >
                <div className="flex items-start gap-4 md:flex-col md:items-start">
                  <span className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold text-[color:var(--brand-ocean-text)]">
                    {c.n}
                  </span>
                  <p className="pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                    {c.label}
                  </p>
                </div>
                <div>
                  <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
                    {c.title}
                  </h2>
                  <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/80">
                    {c.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Ranked candidate delivery */}
      <PublicSection>
        <PublicPage>
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
                Chapter 05 — Ranking + evidence
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                Every shortlist arrives ranked and cited.
              </h2>
              <p className="mt-4 max-w-xl text-[color:var(--brand-navy)]/80">
                Every shortlist arrives ranked against a role-specific rubric,
                with evidence from the CV attached to each requirement. The
                client sees the same view the recruiter used to build it.
              </p>
            </div>
            <RankedShortlistMock />
          </div>
        </PublicPage>
      </PublicSection>

      {/* Client workspace visibility */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div className="md:order-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
                Chapter 04 — The live workspace
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                One workspace per requisition.
              </h2>
              <p className="mt-4 max-w-xl text-[color:var(--brand-navy)]/80">
                One workspace per requisition, one aggregate view across all
                of them. Progress, evidence and recruiter notes live in the
                same surface the hiring team uses to decide.
              </p>
            </div>
            <div className="md:order-1">
              <WorkspaceMock />
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Decision-making and control */}
      <PublicSection>
        <PublicPage>
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
                Chapter 06 — Client control
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                Every action is captured with a reason.
              </h2>
              <p className="mt-4 max-w-xl text-[color:var(--brand-navy)]/80">
                Advance, hold or pass — every action is captured with the
                reason and the person who took it. Nothing about the search
                is a black box; nothing depends on a private inbox.
              </p>
            </div>
            <DecisionMock />
          </div>
        </PublicPage>
      </PublicSection>

      {/* Evidence chapter (extra reinforcement) */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)] py-20 text-white">
        <PublicPage>
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                Why the model is different from agencies
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                Evidence tied to the CV — not a summary paragraph.
              </h2>
              <ul className="mt-6 space-y-3 text-white/80">
                <li>· Subscription pricing instead of placement-fee incentives.</li>
                <li>· Rubrics and citations instead of curated summaries.</li>
                <li>· One shared workspace instead of private inboxes.</li>
                <li>· Full pipeline ownership — the candidates are yours.</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-2 text-[color:var(--brand-navy)]">
              <EvidenceMock />
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Chapter 07 — Economics */}
      <PublicSection>
        <PublicPage>
          <div className="grid gap-10 md:grid-cols-2 md:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
                Chapter 07 — Economics
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                Priced like software, not like a placement.
              </h2>
              <p className="mt-4 max-w-xl text-[color:var(--brand-navy)]/80">
                A flat subscription instead of contingent fees. Predictable
                per-role economics your finance team can model, and no
                incentive to push a hire that doesn't fit. When the search
                is done, the pipeline stays with you — not the recruiter.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/pricing"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  View pricing
                </Link>
              </div>
            </div>
            <ul className="space-y-3 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
              {[
                "Flat monthly subscription — no placement fees, no percentage of salary",
                "Cancel anytime — no long-term lock-in",
                "The candidates and evidence you paid for stay in your workspace",
                "Finance can forecast recruiting cost like any SaaS line item",
              ].map((point) => (
                <li key={point} className="flex gap-3 text-sm text-[color:var(--brand-navy)]/80">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-ocean)]" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Chapter 08 — The future */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Chapter 08 — What the future looks like
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              Hiring stops being a black box.
            </h2>
            <p className="mt-4 text-[color:var(--brand-navy)]/80">
              Every hire has a rubric behind it. Every rejection has a reason.
              Every pipeline is owned by the company that paid for it. The
              recruiter is still human — the reasoning is finally visible.
              We think that's the version of hiring companies actually want.
            </p>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Founder note */}
      <PublicSection>
        <PublicPage>
          <figure className="mx-auto max-w-3xl rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              A note from the founders
            </p>
            <blockquote className="mt-4 font-[family-name:var(--brand-font-display)] text-2xl leading-snug text-[color:var(--brand-navy)] sm:text-3xl">
              “We built TaaSFlow because hiring was the least explainable part
              of running a company. Every decision now cites the exact CV quote
              it came from. If we can’t cite it, we don’t claim it.”
            </blockquote>
            <figcaption className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold text-[color:var(--brand-navy)]">
                João Luciano, Christian Brogger & João Bogo
              </span>
              <span className="text-[color:var(--brand-navy)]/80">
                Co-founders, TaaSFlow
              </span>
              <Link
                to="/about"
                className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                Meet the team →
              </Link>
            </figcaption>
          </figure>
        </PublicPage>
      </PublicSection>


      {/* Start with TaaSFlow */}
      <CtaSection
        eyebrow="Start with TaaSFlow"
        title="Bring your next hire into the workspace."
        description="Submit a role in the guided intake — your workspace is ready as soon as you finish."
        primary={{ to: "/intake", label: "Start hiring" }}
        secondary={{ to: "/how-it-works", label: "See how it works" }}
      />
          <PageConnections
        commercial={{ to: "/how-it-works", label: "See the model in action", desc: "The product built from this story." }}
        explainer={{ to: "/about", label: "Meet the team", desc: "Founders and operators behind TaaSFlow." }}
        resource={{ to: "/case-studies", label: "Where it lands", desc: "Named outcomes from the current model." }}
        audience={{ to: "/industries", label: "By industry", desc: "How the model adapts to your vertical." }}
      />
    </SiteShell>
  );
}
