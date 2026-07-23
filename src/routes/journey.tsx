import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";

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
        <span className="ml-3 truncate text-xs font-medium text-[color:var(--brand-navy)]/70">
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
              <p className="truncate text-xs text-[color:var(--brand-navy)]/60">
                Evidence: {r.cite}
              </p>
            </div>
            <span className="rounded-full bg-[color:var(--brand-ocean)]/10 px-2.5 py-0.5 text-xs font-semibold text-[color:var(--brand-ocean)]">
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
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
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
            <p className="mt-1 text-xs text-[color:var(--brand-navy)]/60">
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
              <span className="ml-3 text-xs text-[color:var(--brand-navy)]/50">
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
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
          Audit trail
        </p>
        <ul className="mt-2 space-y-1 text-xs text-[color:var(--brand-navy)]/70">
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
    label: "The problem",
    title: "Why hiring is broken",
    body: "As operators we lived it: agencies delivered names without reasoning, RPO added process without improving quality, and every search felt like a fresh set of spreadsheets. There was no shared surface where the rubric, the evidence and the decisions lived together.",
  },
  {
    n: "02",
    label: "The insight",
    title: "The operator insight behind TaaSFlow",
    body: "The problem was not sourcing — it was explainability. If we could write the rubric down, extract evidence for it directly from the CV, and put both in a workspace the client could see, most of the friction disappeared.",
  },
  {
    n: "03",
    label: "The model",
    title: "Building a structured recruiting model",
    body: "Instead of contingent fees, a subscription. Instead of a private inbox, a per-requisition workspace. Instead of a summary paragraph, a rubric with citations. The model is boring on purpose — cadence and clarity beat heroics.",
  },
];

function JourneyPage() {
  return (
    <SiteShell>
      {/* Hero */}
      <PublicSection className="pt-24">
        <PublicPage className="max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-widest text-[color:var(--brand-ocean)]">
            Our journey
          </p>
          <h1 className="mt-3 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            How TaaSFlow became a better recruiting model.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
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
                  <span className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold text-[color:var(--brand-ocean)]">
                    {c.n}
                  </span>
                  <p className="pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                    {c.label}
                  </p>
                </div>
                <div>
                  <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
                    {c.title}
                  </h2>
                  <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/75">
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
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
                Chapter 04
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                Ranked candidate delivery
              </h2>
              <p className="mt-4 max-w-xl text-[color:var(--brand-navy)]/75">
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
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
                Chapter 05
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                Client workspace visibility
              </h2>
              <p className="mt-4 max-w-xl text-[color:var(--brand-navy)]/75">
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
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
                Chapter 06
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                Decision-making and control
              </h2>
              <p className="mt-4 max-w-xl text-[color:var(--brand-navy)]/75">
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

      {/* Start with TaaSFlow */}
      <CtaSection
        eyebrow="Start with TaaSFlow"
        title="Bring your next hire into the workspace."
        description="Submit a role in the guided intake — your workspace is ready as soon as you finish."
        primary={{ to: "/intake", label: "Start hiring" }}
        secondary={{ to: "/how-it-works", label: "See how it works" }}
      />
    </SiteShell>
  );
}
