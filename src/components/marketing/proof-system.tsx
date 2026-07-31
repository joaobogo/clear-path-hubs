import * as React from "react";
import { Link } from "@tanstack/react-router";
import { PRICE_SUB_BRONZE_USD } from "@/config/pricing-core";

/** Agency benchmark used in the cost comparison. Contingency fees typically
 *  run 20–25% of first-year salary; we quote the midpoint and show the math. */
const AGENCY_FEE_PCT = 22;
const BENCHMARK_SALARY_USD = 150_000;
const AGENCY_FEE_USD = Math.round((BENCHMARK_SALARY_USD * AGENCY_FEE_PCT) / 100);
const COST_DIFFERENCE_USD = AGENCY_FEE_USD - PRICE_SUB_BRONZE_USD;
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Eye,
  FileSearch,
  KeyRound,
  ListOrdered,
  Repeat,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
  Wallet,
  ChevronDown,
} from "lucide-react";

/**
 * Proof system without fake testimonials.
 * Only verified outcomes, process credibility, operator credibility,
 * product-pattern proof, case-study summaries, calculator math,
 * and risk-reducing FAQ.
 */

const VERIFIED_OUTCOMES = [
  {
    icon: ListOrdered,
    stat: "5–12",
    unit: "ranked candidates",
    line: "Published per role in week 1. Ordered by requirement coverage, not opinion.",
  },
  {
    icon: FileSearch,
    stat: "100%",
    unit: "requirements cited",
    line: "Every must-have carries a coverage score and a source line from the CV or the application.",
  },
  {
    icon: BadgeCheck,
    stat: "0",
    unit: "auto-publishes",
    line: "A recruiter reviews and approves each candidate before your workspace shows them.",
  },
] as const;

const PROCESS_STEPS = [
  { icon: ClipboardCheck, t: "Structured intake", d: "Requirements, weighting, and interview themes captured in a 5-step brief before sourcing starts." },
  { icon: Users, t: "Sourced by a named recruiter", d: "A person runs the search — direct outreach and inbound review, not just an aggregator." },
  { icon: FileSearch, t: "Evidence extracted per requirement", d: "For each must-have, we cite the sentence in the CV or application answer that supports the score." },
  { icon: UserCheck, t: "Human review before publish", d: "A recruiter reads every candidate and signs off before the workspace shows them to your team." },
  { icon: Eye, t: "Live pipeline stages", d: "Under review → shortlisted → interview → offer. Same URL for you and the recruiter." },
  { icon: ShieldCheck, t: "Full audit trail", d: "Every approval, stage move, and evidence edit is recorded and exportable." },
] as const;

const PRODUCT_PATTERNS = [
  {
    icon: ListOrdered,
    label: "Ranked shortlist",
    detail: "Candidates ordered 0–100. Bands: Top fit / Strong fit / Consider.",
  },
  {
    icon: FileSearch,
    label: "Coverage per requirement",
    detail: "Percent match + cited source sentence for every must-have.",
  },
  {
    icon: Eye,
    label: "Live pipeline",
    detail: "Stage aging, next action, and the recruiter's note — visible on the same page.",
  },
  {
    icon: KeyRound,
    label: "Export any month",
    detail: "Candidates, notes, and evidence belong to your workspace. No lock-in.",
  },
] as const;

const CASE_SUMMARIES = [
  {
    industry: "Hospitality",
    role: "Regional Ops Director, EMEA",
    line: "Retained-model replacement. Ranked shortlist in week 1, hire signed in week 4.",
  },
  {
    industry: "Finance",
    role: "Senior Compliance Manager",
    line: "Requirements-driven search across two regulated jurisdictions with evidence per credential.",
  },
  {
    industry: "Healthcare",
    role: "Head of Clinical Operations",
    line: "12 candidates, 5 interviewed, 1 hired — same workspace shared with the CMO throughout.",
  },
] as const;

const FAQ = [
  {
    q: "What if the first shortlist is wrong?",
    a: "Tell the recruiter in the workspace. The requirements are re-weighted and the next batch reflects the change — no restart fee, no new brief cycle.",
  },
  {
    q: "Do we have to switch our ATS?",
    a: "No. TaaSFlow includes its own ATS, and it also sits alongside Greenhouse, Ashby, Lever, or Workday. Use ours or keep yours — either way you get the recruiting, the outreach, and the evidence in one place.",
  },
  {
    q: "What happens if we cancel?",
    a: "You keep your workspace data — candidates, notes, evidence, decisions. Export any month. No placement clawbacks, no restrictive covenants on candidates.",
  },
  {
    q: "How is this different from an AI sourcing tool?",
    a: "A named recruiter runs each search and signs off on every candidate. AI structures the evidence and the scoring; it does not decide who reaches your shortlist.",
  },
  {
    q: "Is our data used to train models?",
    a: "No. CVs are stored in a private bucket with row-level security. LLM calls run on evidence extraction only, and prompts are not used for model training.",
  },
] as const;

export function ProofSystem() {
  const [openIdx, setOpenIdx] = React.useState<number>(0);

  return (
    <section
      aria-labelledby="proof-system-heading"
      className="bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/80">
            How the model works in practice
          </span>
          <h2
            id="proof-system-heading"
            className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold leading-tight tracking-tight text-[color:var(--brand-navy)] sm:text-4xl"
          >
            Proof without invented quotes.
          </h2>
          <p className="mt-3 text-base text-[color:var(--brand-navy)]/80">
            We do not publish testimonials we cannot verify. Instead we show
            the pattern the model produces on every role — the numbers a
            recruiter can defend, the steps that always run, and the artefacts
            your team can inspect inside the workspace.
          </p>
        </div>

        {/* 1 — Verified outcome pattern */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {VERIFIED_OUTCOMES.map((o) => (
            <div
              key={o.unit}
              className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-5"
            >
              <o.icon className="h-5 w-5 text-[color:var(--brand-ocean-text)]" aria-hidden />
              <div className="mt-4 font-[family-name:var(--brand-font-display)] text-3xl font-semibold text-[color:var(--brand-navy)]">
                {o.stat}
              </div>
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
                {o.unit}
              </div>
              <p className="mt-2 text-sm leading-snug text-[color:var(--brand-navy)]/80">
                {o.line}
              </p>
            </div>
          ))}
        </div>

        {/* 2 — Process credibility */}
        <div className="mt-14">
          <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
            The same six steps run on every role.
          </h3>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROCESS_STEPS.map((s, i) => (
              <li
                key={s.t}
                className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-navy)]/6 text-[12px] font-semibold text-[color:var(--brand-navy)]">
                    {i + 1}
                  </span>
                  <s.icon className="h-4 w-4 text-[color:var(--brand-ocean-text)]" aria-hidden />
                  <span className="text-sm font-semibold text-[color:var(--brand-navy)]">
                    {s.t}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-snug text-[color:var(--brand-navy)]/80">
                  {s.d}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* 3 — Operator credibility + 4 — Product patterns (two-column) */}
        <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          {/* Operator credibility */}
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)] p-6 text-white sm:p-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Who runs this
            </span>
            <h3 className="mt-3 font-[family-name:var(--brand-font-display)] text-2xl font-semibold leading-tight">
              Built by operators who ran the searches.
            </h3>
            <ul className="mt-6 space-y-4">
              <li>
                <div className="text-sm font-semibold text-white">
                  Christian Brogger — Co-founder & CEO
                </div>
                <div className="mt-1 text-[12px] leading-snug text-white/70">
                  25 years in PE-backed and Fortune 500 hiring. Ran talent
                  functions before building the product to fix them.
                </div>
              </li>
              <li>
                <div className="text-sm font-semibold text-white">
                  João Bogo — Co-founder & CMO
                </div>
                <div className="mt-1 text-[12px] leading-snug text-white/70">
                  Global talent strategy at Hilton and Marriott. Owns how the
                  workspace communicates with clients and candidates.
                </div>
              </li>
            </ul>
            <Link
              to="/about"
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-sky)] hover:text-white"
            >
              Meet the team <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          {/* Product patterns */}
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-6 sm:p-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/80">
              What lives in the workspace
            </span>
            <h3 className="mt-3 font-[family-name:var(--brand-font-display)] text-2xl font-semibold leading-tight text-[color:var(--brand-navy)]">
              Real product patterns. Same ones on every role.
            </h3>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {PRODUCT_PATTERNS.map((p) => (
                <li
                  key={p.label}
                  className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4"
                >
                  <div className="flex items-center gap-2">
                    <p.icon className="h-4 w-4 text-[color:var(--brand-ocean-text)]" aria-hidden />
                    <span className="text-sm font-semibold text-[color:var(--brand-navy)]">
                      {p.label}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-snug text-[color:var(--brand-navy)]/80">
                    {p.detail}
                  </p>
                </li>
              ))}
            </ul>
            <Link
              to="/how-it-works"
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)]"
            >
              Tour the workspace <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        {/* 5 — Case study summaries + 6 — Calculator math (two-column) */}
        <div className="mt-14 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Case summaries */}
          <div>
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                Recent search patterns.
              </h3>
              <Link
                to="/case-studies"
                className="hidden text-sm font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)] sm:inline-flex"
              >
                All case studies →
              </Link>
            </div>
            <ul className="mt-5 space-y-3">
              {CASE_SUMMARIES.map((c) => (
                <li
                  key={c.role}
                  className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-5"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-ocean-text)]">
                      {c.industry}
                    </span>
                    <span className="text-sm font-semibold text-[color:var(--brand-navy)]">
                      {c.role}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-snug text-[color:var(--brand-navy)]/80">
                    {c.line}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Calculator math */}
          <div className="rounded-2xl border border-[color:var(--brand-ocean)]/25 bg-gradient-to-br from-[color:var(--brand-sky)]/40 to-[color:var(--brand-paper)] p-6 sm:p-8">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/80">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              The math, without a call
            </span>
            <h3 className="mt-3 font-[family-name:var(--brand-font-display)] text-2xl font-semibold leading-tight text-[color:var(--brand-navy)]">
              One $150k hire.
              <br />
              Two cost paths.
            </h3>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-4 border-b border-[color:var(--brand-navy)]/10 pb-3">
                <dt className="text-[color:var(--brand-navy)]/80">
                  Contingency agency (22% of first-year salary)
                </dt>
                <dd className="font-semibold tabular-nums text-[color:var(--brand-navy)]">
                  $33,000
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-[color:var(--brand-navy)]/10 pb-3">
                <dt className="text-[color:var(--brand-navy)]/80">
                  TaaSFlow Growth (one month, flat)
                </dt>
                <dd className="font-semibold tabular-nums text-[color:var(--brand-ocean-text)]">
                  $5,900
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-sm font-semibold text-[color:var(--brand-navy)]">
                  Difference on one hire
                </dt>
                <dd className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tabular-nums text-[color:var(--brand-navy)]">
                  $27,100
                </dd>
              </div>
            </dl>
            <a
              href="#roi-calculator"
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)]"
            >
              Run your own numbers <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>

        {/* 7 — Risk-reducing FAQ */}
        <div className="mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
              What people ask before signing.
            </h3>
            <span className="text-[12px] text-[color:var(--brand-navy)]/80">
              Straight answers. No sales dance.
            </span>
          </div>
          <ul className="mt-5 divide-y divide-[color:var(--brand-navy)]/10 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            {FAQ.map((f, i) => {
              const open = openIdx === i;
              return (
                <li key={f.q}>
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? -1 : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                  >
                    <span className="text-sm font-semibold text-[color:var(--brand-navy)]">
                      {f.q}
                    </span>
                    <ChevronDown
                      className={
                        "h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/80 transition-transform " +
                        (open ? "rotate-180" : "")
                      }
                      aria-hidden
                    />
                  </button>
                  {open && (
                    <div className="px-5 pb-5 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                      {f.a}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
