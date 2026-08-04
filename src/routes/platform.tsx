/**
 * /platform — the system architecture page.
 *
 * Built around the real flow: role requirements → Intake Engine → Blueprint
 * Compiler → Agent Layer → Evidence Graph → Scoring Engine → Decision
 * Workspace → hiring outcomes → Talent Graph learning loop.
 *
 * Every capability stated here is traceable to shipped code. Human involvement
 * appears as governance: approval gates, escalation, audit.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Minus, Sparkles } from "lucide-react";

import {
  PublicPage,
  PublicSection,
  SiteShell,
  CtaSection,
} from "@/components/marketing/site-shell";
import { PlatformArchitecture } from "@/components/marketing/platform-architecture";
import { EvidenceGraph } from "@/components/evidence/evidence-graph";
import { REPRESENTATIVE_CHAIN } from "@/lib/evidence/evidence-graph";
import { marketingHead } from "@/lib/marketing/head";
import {
  PRODUCT_CATEGORY,
  SYSTEM_CLAIM,
  MODULES,
  OVERSIGHT_LANGUAGE,
} from "@/config/product-language";

export const Route = createFileRoute("/platform")({
  head: () =>
    marketingHead(undefined, "/platform", {
      title: `The TaaSFlow Platform — ${PRODUCT_CATEGORY}, in one system`,
      description:
        `${SYSTEM_CLAIM} ${MODULES.intake}, ${MODULES.blueprint}, ${MODULES.agents}, ${MODULES.evidence}, ${MODULES.scoring}, ${MODULES.workspace} and ${MODULES.talentGraph} — one governed system, with an audit trail on every decision.`,
    }),
  component: PlatformPage,
});

/* ------------------------------------------------------------ System controls */

const CONTROLS: readonly { title: string; detail: string }[] = [
  {
    title: "Approval gates",
    detail:
      "No candidate reaches your shortlist until evidence is verified and the release is approved.",
  },
  {
    title: "Scoring rubric versions",
    detail:
      "Each score names the rubric version it ran on. Versions are frozen once scored against.",
  },
  {
    title: "Role-specific configuration",
    detail:
      "Weights, must-haves and intensity — steady, standard or aggressive — are set per role.",
  },
  {
    title: "Agent status",
    detail:
      "Enable, pause or disable any agent per role. Paused agents stop; the change is logged.",
  },
  {
    title: "Audit history",
    detail:
      "Every state change, override, release and access event is appended, never edited.",
  },
  {
    title: "Human escalation",
    detail: OVERSIGHT_LANGUAGE.escalation + ".",
  },
];

/* ------------------------------------------------------------ Learning loop */

const LOOP: readonly { step: string; title: string; detail: string }[] = [
  {
    step: "01",
    title: "Outcome is recorded",
    detail: "Hire, reject or withdrawal — with the reason captured at decision time.",
  },
  {
    step: "02",
    title: "Evidence is retained",
    detail: "The verified evidence behind that outcome stays attached to the record.",
  },
  {
    step: "03",
    title: "Role memory is written",
    detail: "What worked and what to avoid is kept as notes against the role family.",
  },
  {
    step: "04",
    title: "Next role reads it",
    detail:
      "New rubrics resurface past candidates and inherit role memory, so briefing starts ahead.",
  },
];

/* ------------------------------------------------------------ Positioning */

const CATEGORIES: readonly { label: string; role: string; gap: string }[] = [
  {
    label: "Applicant Tracking (ATS)",
    role: "Stores records.",
    gap: "Doesn't source, doesn't score, doesn't produce a shortlist.",
  },
  {
    label: "Recruiting agency",
    role: "Delivers candidates.",
    gap: "Doesn't leave a system behind — the pipeline goes with the vendor.",
  },
  {
    label: "AI sourcing tool",
    role: "Finds profiles at scale.",
    gap: "Doesn't run intake, doesn't score against a rubric, doesn't hand off to hiring.",
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
      {/* 1 — PLATFORM INTRODUCTION */}
      <section
        aria-labelledby="platform-hero"
        className="relative overflow-hidden bg-gradient-to-b from-[color:var(--brand-sky)]/30 via-[color:var(--brand-paper)] to-[color:var(--brand-paper)]"
      >
        <PublicPage>
          <div className="py-16 sm:py-20 lg:py-24">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--brand-navy)]/12 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-ocean-text)]" aria-hidden />
              {PRODUCT_CATEGORY}
            </span>
            <h1
              id="platform-hero"
              className="mt-4 max-w-4xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-5xl lg:text-[3.5rem]"
            >
              Hiring, run as a governed system.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
              {SYSTEM_CLAIM} Requirements enter once, compile into a versioned rubric,
              and every step after that is recorded — so you can see why a candidate
              ranked where they did.
            </p>

            <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "One record per role and candidate",
                "Rubric version on every score",
                "Approval gate before release",
                "Append-only audit trail",
              ].map((t) => (
                <li
                  key={t}
                  className="inline-flex items-start gap-2 rounded-lg border border-[color:var(--brand-navy)]/10 bg-white px-3 py-2 text-sm font-semibold text-[color:var(--brand-navy)]"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean-text)]"
                    aria-hidden
                  />
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/intake"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                Open your first role <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/agents"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
              >
                See the {MODULES.agents}
              </Link>
            </div>
          </div>
        </PublicPage>
      </section>

      {/* 2 — INTERACTIVE ARCHITECTURE */}
      <PublicSection className="bg-white">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              System architecture
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Pick a module. See exactly what it does.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              What enters it, what it does, what it produces, what you control, and what
              gets recorded.
            </p>
          </div>

          <div className="mt-10">
            <PlatformArchitecture />
          </div>
        </PublicPage>
      </PublicSection>

      {/* 2b — EVIDENCE GRAPH */}
      <PublicSection id="evidence-graph" className="bg-white">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Evidence graph
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Every score traces back to a quote.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              Requirement, evidence, source, rule, points, decision. Pick a requirement
              and follow the whole chain. Where evidence is missing, it says so.
            </p>
          </div>

          <div className="mt-10">
            <EvidenceGraph
              nodes={REPRESENTATIVE_CHAIN.nodes}
              meta={REPRESENTATIVE_CHAIN.meta}
              variant="compact"
              representative
              idPrefix="public-evidence-graph"
              title="Evidence graph — a scored candidate"
              description="Representative data for one senior platform role. In the workspace this is the real record, with reviewer history attached."
            />
          </div>
        </PublicPage>
      </PublicSection>



      {/* 3 — SYSTEM CONTROLS */}
      <PublicSection className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Governance
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              The controls that sit over the system.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              People stay in the loop as governance — approving, escalating and
              overriding, with each action logged.
            </p>
          </div>

          <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map((c) => (
              <div
                key={c.title}
                className="min-w-0 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5"
              >
                <dt className="text-base font-semibold text-[color:var(--brand-navy)]">
                  {c.title}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                  {c.detail}
                </dd>
              </div>
            ))}
          </dl>
        </PublicPage>
      </PublicSection>

      {/* 4 — LEARNING LOOP */}
      <PublicSection className="bg-white">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              {MODULES.talentGraph}
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Each closed role makes the next one shorter.
            </h2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              Not a model that trains itself. Verified outcomes, retained evidence and
              role memory that your next rubric can read.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {LOOP.map((l) => (
              <li
                key={l.step}
                className="min-w-0 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-5"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
                  {l.step}
                </span>
                <h3 className="mt-1 text-base font-semibold text-[color:var(--brand-navy)]">
                  {l.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                  {l.detail}
                </p>
              </li>
            ))}
          </ol>

          <p className="mt-6 max-w-3xl rounded-xl border border-dashed border-[color:var(--brand-navy)]/20 bg-[color:var(--brand-paper)] p-4 text-sm text-[color:var(--brand-navy)]/80">
            Retained data stays inside your organisation. You can edit or remove any
            record, and every re-engagement is logged.
          </p>
        </PublicPage>
      </PublicSection>

      {/* POSITIONING MATRIX */}
      <PublicSection className="border-y border-[color:var(--brand-navy)]/8 bg-[color:var(--brand-paper)]">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Where the neighbours stop
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Adjacent categories, and the gap they leave.
            </h2>
          </div>

          <div className="mt-10 overflow-x-auto rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            <table className="w-full min-w-[36rem] text-left text-sm">
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
                    Runs the whole loop — intake, rubric, agents, evidence, scoring,
                    decisions and memory — in one system you keep.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                <Minus className="h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/80" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </PublicPage>
      </PublicSection>

      {/* 5 — PRODUCT CTA */}
      <CtaSection
        eyebrow="Ready to see it"
        title="Open a role. Watch the system run."
        description="Submit intake and see the compiled rubric, agent runs, and first evidence-backed shortlist inside your workspace."
        primary={{ to: "/intake", label: "Open your first role" }}
        secondary={{ to: "/pricing", label: "View Pricing" }}
      />
    </SiteShell>
  );
}
