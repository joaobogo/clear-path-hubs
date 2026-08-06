/**
 * "Proof that lowers hiring risk" — three concrete artefacts a buyer receives,
 * shown as labelled samples. No customer logos, no unverifiable claims, no
 * fabricated testimonials.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, FileText, Quote } from "lucide-react";

const SCORECARD = {
  role: "Senior Product Designer",
  candidate: "Candidate A-1042",
  total: 94,
  lines: [
    { label: "Role Fit", value: 96, note: "Owned a design-system rollout across three product lines." },
    { label: "Evidence", value: 93, note: "Six years of B2B SaaS work, verifiable in the CV and portfolio." },
    { label: "Logistics", value: 88, note: "Available in 4 weeks; remote-friendly in your timezone band." },
    { label: "Signal", value: 91, note: "Consistent tenure, no unexplained gaps, promotion within the last role." },
  ],
};

const NARRATIVE = [
  "Strongest evidence in the batch on design-system ownership: named owner of a rollout across three product lines, with documented adoption in ten squads.",
  "B2B depth is real, not adjacent — six years shipping products used daily by revenue and operations teams.",
  "One thing to validate in interview: hands-on design-ops tooling scope versus partnership with engineering. Ask for a concrete example of a token migration they ran end to end.",
];

const TIMELINE = [
  { when: "Day 1", what: "Intake locked", detail: "Job description completed/ uploaded and scoring model defined. Your User Account set up on the platform - Welcome!" },
  { when: "Day 1", what: "Sourcing and screening starts", detail: "Monitoring of CVs and scoring results — adjust scoring model if required." },
  { when: "Day 2–14", what: "Your candidate dashboard is live", detail: "Review your candidates' evidence-based scoring. 24/7." },
  { when: "Daily/Weekly activity", what: "Interviews and ATS", detail: "Start interviews with candidates and manage all interview activities in the ATS space." },
];

export function RiskProof({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
          Proof that lowers hiring risk
        </p>
        <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
          See the work before you buy it.
        </h2>
        <p className="mt-4 text-base text-[color:var(--brand-navy)]/80">
          Three artefacts you receive on every engagement — a scored candidate,
          a recruiter's written judgement, and a delivery rhythm you can plan
          against. Samples below use anonymized example data.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {/* 1 — Sample scorecard */}
        <article className="flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-6 shadow-[var(--brand-shadow-sm)]">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[color:var(--brand-ocean-text)]" aria-hidden />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
              Sample candidate scorecard
            </h3>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--brand-navy)]">
                {SCORECARD.candidate}
              </p>
              <p className="truncate text-xs text-[color:var(--brand-navy)]/80">
                {SCORECARD.role}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold leading-none text-[color:var(--brand-navy)]">
                {SCORECARD.total}
              </span>
              <span className="ml-1 text-xs font-semibold text-[color:var(--brand-navy)]/80">
                /100
              </span>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {SCORECARD.lines.map((l) => (
              <div key={l.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold text-[color:var(--brand-navy)]">
                    {l.label}
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-[color:var(--brand-navy)]/80">
                    {l.value}
                  </p>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--brand-navy)]/10">
                  <div
                    className="h-full rounded-full bg-[color:var(--brand-ocean)]"
                    style={{ width: `${l.value}%` }}
                  />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[color:var(--brand-navy)]/80">
                  {l.note}
                </p>
              </div>
            ))}
          </div>
        </article>

        {/* 2 — Sample fit narrative */}
        <article className="flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-6 shadow-[var(--brand-shadow-sm)]">
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-[color:var(--brand-ocean-text)]" aria-hidden />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
              Sample recruiter fit narrative
            </h3>
          </div>
          <p className="mt-4 text-xs text-[color:var(--brand-navy)]/80">
            Written by the recruiter who read the CV — not generated and shipped
            unread.
          </p>
          <ul className="mt-4 space-y-3 border-l-2 border-[color:var(--brand-ocean)]/30 pl-4">
            {NARRATIVE.map((n) => (
              <li
                key={n}
                className="text-sm leading-relaxed text-[color:var(--brand-navy)]/80"
              >
                {n}
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-5 text-xs text-[color:var(--brand-navy)]/80">
            Every narrative names what to validate — not just what looks good.
          </p>
        </article>

        {/* 3 — Sample weekly delivery timeline */}
        <article className="flex flex-col rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-6 shadow-[var(--brand-shadow-sm)]">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[color:var(--brand-ocean-text)]" aria-hidden />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
              Sample delivery timeline
            </h3>
          </div>
          <ol className="mt-4 space-y-4">
            {TIMELINE.map((t, i) => (
              <li key={t.what} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--brand-navy)]/[0.07] text-[11px] font-semibold text-[color:var(--brand-navy)]"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-ocean-text)]">
                    {t.when}
                  </p>
                  <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
                    {t.what}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--brand-navy)]/80">
                    {t.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </article>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] px-5 py-4 text-sm text-[color:var(--brand-navy)]/80">
        <span>
          We publish outcomes only once a client approves them by name, industry,
          and result — no unverifiable logos or invented testimonials.
        </span>
        <Link
          to="/case-studies"
          className="inline-flex items-center gap-1 font-semibold text-[color:var(--brand-ocean-text)] hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
        >
          Read published outcomes <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
