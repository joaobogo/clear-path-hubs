import * as React from "react";
import { Check, Minus, X, ChevronRight } from "lucide-react";

/**
 * "Why teams switch to TaaSFlow" decision matrix.
 * Desktop: 4-column scannable grid.
 * Mobile: stacked cards per option — no giant table.
 */

type Score = "full" | "partial" | "none";

const DIMENSIONS = [
  "Sourcing execution",
  "Candidate ranking",
  "Evidence quality",
  "Visibility",
  "Control",
  "Pricing model",
  "Continuity across roles",
] as const;

type Option = {
  key: string;
  name: string;
  tagline: string;
  highlight?: boolean;
  scores: Record<(typeof DIMENSIONS)[number], { score: Score; note: string }>;
};

const OPTIONS: Option[] = [
  {
    key: "agency",
    name: "Traditional agencies",
    tagline: "Contingency or retained. 20–25% of first-year salary.",
    scores: {
      "Sourcing execution": { score: "full", note: "Recruiter runs the search." },
      "Candidate ranking": { score: "partial", note: "Ordered by recruiter opinion, rarely explained." },
      "Evidence quality": { score: "none", note: "CV forwarded. No cited requirement coverage." },
      "Visibility": { score: "none", note: "Email updates on their schedule." },
      "Control": { score: "partial", note: "You interview, they gatekeep." },
      "Pricing model": { score: "none", note: "Placement fees. Pay per hire." },
      "Continuity across roles": { score: "none", note: "New brief, new fee, new relationship." },
    },
  },
  {
    key: "internal",
    name: "Internal-only recruiting",
    tagline: "Your TA team or founders running searches directly.",
    scores: {
      "Sourcing execution": { score: "partial", note: "Depends on capacity that quarter." },
      "Candidate ranking": { score: "partial", note: "Manual scoring, inconsistent between hiring managers." },
      "Evidence quality": { score: "partial", note: "Good when senior TA runs it. Uneven otherwise." },
      "Visibility": { score: "full", note: "Full visibility — it's your team." },
      "Control": { score: "full", note: "You own every decision." },
      "Pricing model": { score: "partial", note: "Salary + tooling + opportunity cost." },
      "Continuity across roles": { score: "partial", note: "Continuous, but throughput capped by headcount." },
    },
  },
  {
    key: "ats",
    name: "ATS-only software",
    tagline: "Greenhouse, Ashby, Lever — a system, not a recruiter.",
    scores: {
      "Sourcing execution": { score: "none", note: "Software doesn't source. You do." },
      "Candidate ranking": { score: "partial", note: "Basic filters. No cited-evidence ranking." },
      "Evidence quality": { score: "none", note: "Stores CVs. Does not extract or cite." },
      "Visibility": { score: "full", note: "Pipeline stages, well-designed." },
      "Control": { score: "full", note: "You own the pipeline and the tool." },
      "Pricing model": { score: "full", note: "Flat SaaS seat pricing." },
      "Continuity across roles": { score: "full", note: "Persistent. But still no delivery." },
    },
  },
  {
    key: "taasflow",
    name: "TaaSFlow",
    tagline: "Recruiting execution + live workspace + evidence — one flat subscription.",
    highlight: true,
    scores: {
      "Sourcing execution": { score: "full", note: "Named recruiter runs each search." },
      "Candidate ranking": { score: "full", note: "Ranked 0–100 by requirement coverage." },
      "Evidence quality": { score: "full", note: "Each requirement cites the source sentence." },
      "Visibility": { score: "full", note: "Live workspace. Same URL as the recruiter." },
      "Control": { score: "full", note: "You own the pipeline, the ATS, and the final call." },
      "Pricing model": { score: "full", note: "Flat monthly subscription. No placement fees." },
      "Continuity across roles": { score: "full", note: "Same workspace across every open role." },
    },
  },
];

function ScoreDot({ score }: { score: Score }) {
  if (score === "full") {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--brand-ocean)]/15 text-[color:var(--brand-ocean-text)]"
        aria-label="Strong"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  if (score === "partial") {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]/80"
        aria-label="Partial"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--brand-navy)]/6 text-[color:var(--brand-navy)]/80"
      aria-label="Gap"
    >
      <X className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

export function WhySwitchMatrix() {
  const [openKey, setOpenKey] = React.useState<string>("taasflow");

  return (
    <section
      aria-labelledby="why-switch-heading"
      className="bg-[color:var(--brand-paper)]"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/80">
            The decision matrix
          </span>
          <h2
            id="why-switch-heading"
            className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold leading-tight tracking-tight text-[color:var(--brand-navy)] sm:text-4xl"
          >
            Why teams switch to TaaSFlow.
          </h2>
          <p className="mt-3 text-base text-[color:var(--brand-navy)]/80">
            Four ways teams hire today. Seven dimensions that decide the outcome.
            Compare, then choose.
          </p>
        </div>

        {/* Desktop grid — hidden on mobile */}
        <div className="mt-10 hidden overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white shadow-[var(--brand-shadow-lg)] lg:block">
          {/* Header row */}
          <div className="grid grid-cols-[minmax(200px,1.1fr)_repeat(4,1fr)] border-b border-[color:var(--brand-navy)]/10">
            <div className="p-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              Dimension
            </div>
            {OPTIONS.map((o) => (
              <div
                key={o.key}
                className={
                  "border-l border-[color:var(--brand-navy)]/10 p-5 " +
                  (o.highlight
                    ? "bg-[color:var(--brand-ocean)]/[0.04]"
                    : "")
                }
              >
                <div
                  className={
                    "text-sm font-semibold " +
                    (o.highlight
                      ? "text-[color:var(--brand-ocean-text)]"
                      : "text-[color:var(--brand-navy)]")
                  }
                >
                  {o.name}
                </div>
                <div className="mt-1 text-[11px] leading-snug text-[color:var(--brand-navy)]/80">
                  {o.tagline}
                </div>
              </div>
            ))}
          </div>

          {/* Body rows */}
          {DIMENSIONS.map((dim, idx) => (
            <div
              key={dim}
              className={
                "grid grid-cols-[minmax(200px,1.1fr)_repeat(4,1fr)] " +
                (idx !== DIMENSIONS.length - 1
                  ? "border-b border-[color:var(--brand-navy)]/8"
                  : "")
              }
            >
              <div className="flex items-center p-5 text-sm font-medium text-[color:var(--brand-navy)]">
                {dim}
              </div>
              {OPTIONS.map((o) => {
                const cell = o.scores[dim];
                return (
                  <div
                    key={o.key + dim}
                    className={
                      "flex items-start gap-3 border-l border-[color:var(--brand-navy)]/8 p-5 " +
                      (o.highlight ? "bg-[color:var(--brand-ocean)]/[0.04]" : "")
                    }
                  >
                    <ScoreDot score={cell.score} />
                    <div className="text-[12px] leading-snug text-[color:var(--brand-navy)]/80">
                      {cell.note}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Mobile / tablet — accordion cards, one per option */}
        <div className="mt-8 space-y-3 lg:hidden">
          {OPTIONS.map((o) => {
            const open = openKey === o.key;
            return (
              <div
                key={o.key}
                className={
                  "overflow-hidden rounded-xl border bg-white transition-colors " +
                  (o.highlight
                    ? "border-[color:var(--brand-ocean)]/40 shadow-[var(--brand-shadow-md)]"
                    : "border-[color:var(--brand-navy)]/10")
                }
              >
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? "" : o.key)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  <div className="min-w-0">
                    <div
                      className={
                        "text-sm font-semibold " +
                        (o.highlight
                          ? "text-[color:var(--brand-ocean-text)]"
                          : "text-[color:var(--brand-navy)]")
                      }
                    >
                      {o.name}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-[color:var(--brand-navy)]/80">
                      {o.tagline}
                    </div>
                  </div>
                  <ChevronRight
                    className={
                      "h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/80 transition-transform " +
                      (open ? "rotate-90" : "")
                    }
                    aria-hidden
                  />
                </button>
                {open && (
                  <ul className="divide-y divide-[color:var(--brand-navy)]/8 border-t border-[color:var(--brand-navy)]/8">
                    {DIMENSIONS.map((dim) => {
                      const cell = o.scores[dim];
                      return (
                        <li
                          key={dim}
                          className="flex items-start gap-3 p-4"
                        >
                          <ScoreDot score={cell.score} />
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-[color:var(--brand-navy)]">
                              {dim}
                            </div>
                            <div className="mt-0.5 text-[12px] leading-snug text-[color:var(--brand-navy)]/80">
                              {cell.note}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-[color:var(--brand-navy)]/80">
          <span className="inline-flex items-center gap-2">
            <ScoreDot score="full" /> Strong
          </span>
          <span className="inline-flex items-center gap-2">
            <ScoreDot score="partial" /> Partial
          </span>
          <span className="inline-flex items-center gap-2">
            <ScoreDot score="none" /> Gap
          </span>
        </div>
      </div>
    </section>
  );
}
