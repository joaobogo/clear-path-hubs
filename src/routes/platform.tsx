/**
 * /platform — Category-defining page.
 *
 * Positions TaaSFlow as its own category: not only an ATS, not only an
 * agency, not only AI sourcing, not only a CRM. Five pillars in one system.
 *
 * Rules honored (Prompt 31 messaging system):
 *   - confident, not arrogant · specific, not fluffy · systems language
 *   - no hype-y AI clichés · no chest-thumping · no agency jargon
 *   - short blocks, one focal point per section
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Database,
  Workflow,
  Ruler,
  MonitorPlay,
  Brain,
  Minus,
  Check,
  Sparkles,
} from "lucide-react";

import {
  PublicPage,
  PublicSection,
  SiteShell,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/platform")({
  head: () =>
    marketingHead(undefined, "/platform", {
      title: "The TaaSFlow Platform — AI Hiring Intelligence, in one system",
      description:
        "Not only an ATS. Not only an agency. Not only AI sourcing. Not only a CRM. TaaSFlow is an AI Hiring Intelligence Platform: Intake Engine, Agent Layer, Evidence Graph, Scoring Engine, Decision Workspace, and Talent Graph — in one system.",
    }),
  component: PlatformPage,
});

/* ------------------------------------------------------------ Pillars */

type Pillar = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  lead: string;
  proof: readonly string[];
};

const PILLARS: readonly Pillar[] = [
  {
    id: "system-of-record",
    icon: Database,
    eyebrow: "Pillar 01",
    title: "Intake Engine and system of record",
    lead:
      "Every role, candidate, evidence note, decision, and message lives in one workspace — versioned and searchable long after the role closes.",
    proof: [
      "One canonical record per candidate, per role",
      "Audit trail on every state change",
      "Candidates and evidence stay when engagements end",
    ],
  },
  {
    id: "recruiting-execution",
    icon: Workflow,
    eyebrow: "Pillar 02",
    title: "Agent Layer",
    lead:
      "Sourcing agents continuously identify, screen and rank against your compiled blueprint — not batched between status calls.",
    proof: [
      "Blueprint Compiler turns intake into the rubric agents run on",
      "Continuous sourcing agents with weekly refresh",
      "One thread from brief to offer, in the workspace",
    ],
  },
  {
    id: "evidence-first-scoring",
    icon: Ruler,
    eyebrow: "Pillar 03",
    title: "Evidence Graph and Scoring Engine",
    lead:
      "Every score cites the CV line or note behind it. Rubric, evidence, and reasoning are visible before the shortlist arrives.",
    proof: [
      "0–100 scores mapped to your must-haves",
      "CV quotes and notes attached to each requirement",
      "Contradictions surfaced, not hidden",
    ],
  },
  {
    id: "live-client-control",
    icon: MonitorPlay,
    eyebrow: "Pillar 04",
    title: "Decision Workspace",
    lead:
      "Shortlist, interview, offer, and hire flow through your workspace — not through a forwarded email.",
    proof: [
      "Kanban pipeline reflecting current state, not a snapshot",
      "Configurable expert oversight in the same thread",
      "Approve, reject, or advance with a click and an audit line",
    ],
  },
  {
    id: "candidate-memory",
    icon: Brain,
    eyebrow: "Pillar 05",
    title: "Talent Graph",
    lead:
      "Silver medalists, prior applicants, and rediscovered talent stay reachable across future roles — not lost when the engagement ends.",
    proof: [
      "Talent pools tied to role families",
      "Rediscovery surface for past strong candidates",
      "Notes and evidence carry into the next brief",
    ],
  },
];

/* ------------------------------------------------------------ Positioning matrix */

type Category = {
  label: string;
  role: string;
  gap: string;
};

const CATEGORIES: readonly Category[] = [
  {
    label: "Applicant Tracking (ATS)",
    role: "Stores records.",
    gap: "Doesn't source, doesn't score, doesn't deliver a shortlist.",
  },
  {
    label: "Recruiting agency",
    role: "Delivers candidates.",
    gap: "Doesn't leave a system behind — the pipeline goes with the vendor.",
  },
  {
    label: "AI sourcing tool",
    role: "Finds profiles at scale.",
    gap: "Doesn't run intake, doesn't own outcomes, doesn't hand-off to hiring.",
  },
  {
    label: "Talent CRM",
    role: "Keeps warm leads.",
    gap: "Doesn't produce ranked, evidenced shortlists on active roles.",
  },
];

/* ------------------------------------------------------------ Component */

function PlatformPage() {
  return (
    <SiteShell>
      {/* HERO */}
      <section
        aria-labelledby="platform-hero"
        className="relative overflow-hidden bg-gradient-to-b from-[color:var(--brand-sky)]/30 via-[color:var(--brand-paper)] to-[color:var(--brand-paper)]"
      >
        <PublicPage>
          <div className="py-16 sm:py-20 lg:py-24">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/12 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-ocean-text)]" aria-hidden />
              A category, not a tool
            </span>
            <h1
              id="platform-hero"
              className="mt-4 max-w-4xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-5xl lg:text-[3.75rem]"
            >
              ATS + recruiting execution, in one system.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
              Not only an ATS. Not only an agency. Not only AI sourcing. Not only a CRM.
              TaaSFlow runs all five jobs — record-keeping, execution, scoring, control,
              and memory — on the same workspace.
            </p>

            {/* Not-only rail */}
            <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "Not only an ATS",
                "Not only an agency",
                "Not only AI sourcing",
                "Not only a CRM",
              ].map((t) => (
                <li
                  key={t}
                  className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2 text-sm font-semibold text-[color:var(--brand-navy)]"
                >
                  <Minus
                    className="h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/80"
                    aria-hidden
                  />
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/intake"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                Start Hiring <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/how-it-works"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                See How It Works
              </Link>
            </div>
          </div>
        </PublicPage>
      </section>

      {/* 5 PILLARS */}
      <PublicSection className="bg-white">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Five jobs, one system
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              What the platform does.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              Each pillar is a working surface — not a slide. Below is what it delivers
              and how you'd notice it inside the workspace.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => {
              const Icon = p.icon;
              return (
                <li
                  key={p.id}
                  className="flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean-text)]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                        {p.eyebrow}
                      </p>
                      <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                        {p.title}
                      </h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                    {p.lead}
                  </p>
                  <ul className="mt-4 space-y-2 border-t border-[color:var(--brand-navy)]/8 pt-4">
                    {p.proof.map((line) => (
                      <li
                        key={line}
                        className="flex items-start gap-2 text-sm text-[color:var(--brand-navy)]/80"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]"
                          aria-hidden
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </PublicPage>
      </PublicSection>

      {/* POSITIONING MATRIX */}
      <PublicSection className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Where the neighbors stop
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Adjacent categories, and the gap they leave.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              Each of these tools solves one piece well. None of them runs the whole loop.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[color:var(--brand-navy)]/[0.04] text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                <tr>
                  <th scope="col" className="px-4 py-3 sm:px-6">Category</th>
                  <th scope="col" className="px-4 py-3 sm:px-6">What it does</th>
                  <th scope="col" className="px-4 py-3 sm:px-6">Where it stops</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((c) => (
                  <tr
                    key={c.label}
                    className="border-t border-[color:var(--brand-navy)]/8 align-top"
                  >
                    <th
                      scope="row"
                      className="px-4 py-4 font-semibold text-[color:var(--brand-navy)] sm:px-6"
                    >
                      {c.label}
                    </th>
                    <td className="px-4 py-4 text-[color:var(--brand-navy)]/80 sm:px-6">
                      {c.role}
                    </td>
                    <td className="px-4 py-4 text-[color:var(--brand-navy)]/80 sm:px-6">
                      {c.gap}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)]/[0.03] align-top">
                  <th
                    scope="row"
                    className="px-4 py-4 font-semibold text-[color:var(--brand-navy)] sm:px-6"
                  >
                    TaaSFlow
                  </th>
                  <td
                    className="px-4 py-4 font-semibold text-[color:var(--brand-navy)] sm:px-6"
                    colSpan={2}
                  >
                    Runs the whole loop — record, execution, scoring, control, and memory
                    — in one workspace you own.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </PublicPage>
      </PublicSection>

      {/* 30-SECOND EXPLAINER */}
      <PublicSection className="bg-white">
        <PublicPage>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              The 30-second version
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              If you only read one paragraph.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--brand-navy)]/85">
              TaaSFlow is the hiring operating system. You brief a role, a recruiter
              confirms the rubric, and the workspace runs sourcing, screening, and
              evidence-first scoring against it every week. You see ranked candidates
              with the reasoning attached, decide inside the same workspace, and keep
              everything — records, candidates, and memory — after the role closes.
            </p>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="Ready to see it"
        title="Open a role. Watch the system run."
        description="Submit intake and see the rubric, sourcing plan, and first ranked shortlist appear inside your workspace within 14 days."
        primary={{ to: "/intake", label: "Start Hiring" }}
        secondary={{ to: "/pricing", label: "View Pricing" }}
      />
    </SiteShell>
  );
}
