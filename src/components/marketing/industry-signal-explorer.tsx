import { useMemo, useState } from "react";
import type { IndustryEntry } from "@/content/industries-v2";

type Signal = { title: string; body: string; category: string };

const BASE_CATEGORIES = [
  "Relevant experience",
  "Industry exposure",
  "Technical capability",
  "Certifications",
  "Leadership",
  "Achievements",
  "Location",
  "Work authorization",
  "Language",
  "Availability",
] as const;

/**
 * Interactive candidate-signal explorer. The industry provides its own
 * signal set; the component augments any missing categories with sensible
 * industry-neutral copy so every industry can render the full pattern.
 * No production candidate data.
 */
export function IndustrySignalExplorer({ entry }: { entry: IndustryEntry }) {
  const signals: Signal[] = useMemo(() => {
    const own: Signal[] = (entry.candidateSignals ?? []).map((s) => ({
      title: s.title,
      body: s.body,
      category: s.title,
    }));
    const filler: Signal[] = BASE_CATEGORIES.filter(
      (c) => !own.some((o) => o.title.toLowerCase() === c.toLowerCase()),
    )
      .slice(0, Math.max(0, 6 - own.length))
      .map((c) => ({
        title: c,
        body: buildFillerCopy(c, entry.name),
        category: c,
      }));
    return [...own, ...filler].slice(0, 8);
  }, [entry]);

  const [activeIdx, setActiveIdx] = useState(0);
  const active = signals[activeIdx];

  return (
    <div>
      <div
        role="tablist"
        aria-label={`${entry.name} candidate signals`}
        className="flex flex-wrap gap-2"
      >
        {signals.map((s, idx) => {
          const selected = idx === activeIdx;
          return (
            <button
              key={s.title}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveIdx(idx)}
              className={[
                "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                selected
                  ? "border-[color:var(--brand-ocean)] bg-[color:var(--brand-ocean)] text-white"
                  : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-ocean)]/40",
              ].join(" ")}
            >
              {s.title}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
            Signal
          </p>
          <h3 className="mt-1 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
            {active.title}
          </h3>
          <p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">
            {active.body}
          </p>
          <div className="mt-5 rounded-xl bg-[color:var(--brand-mist)]/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
              How TaaSFlow validates
            </p>
            <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
              Every match against this signal is tied to a quoted line on the
              CV, reviewed before the shortlist reaches you. Strengths are
              highlighted, and open questions are flagged as validation areas.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
            Other signals reviewed for {entry.name}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
            {signals
              .filter((_, idx) => idx !== activeIdx)
              .map((s) => (
                <li key={s.title} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]/40"
                  />
                  <button
                    onClick={() =>
                      setActiveIdx(signals.findIndex((x) => x.title === s.title))
                    }
                    className="text-left hover:text-[color:var(--brand-ocean)]"
                  >
                    {s.title}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function buildFillerCopy(category: string, industryName: string): string {
  switch (category) {
    case "Relevant experience":
      return `Direct experience in comparable ${industryName} roles, scoped to the seniority and remit of the position.`;
    case "Industry exposure":
      return `Time spent inside ${industryName} organisations, adjacent verticals, or regulated environments that transfer cleanly.`;
    case "Technical capability":
      return `Hands-on capability with the systems, tools and methods the ${industryName} role requires — evidenced, not asserted.`;
    case "Certifications":
      return `Role-relevant certifications, licences or accreditations required or preferred by ${industryName} employers.`;
    case "Leadership":
      return `Team leadership, mentoring or programme ownership evidenced through outcomes, headcount, or stakeholder scope.`;
    case "Achievements":
      return `Quantified achievements the candidate led in ${industryName} contexts — revenue, delivery, quality or programme impact.`;
    case "Location":
      return `Location model captured during intake — on-site, hybrid or remote — is a first-class filter, not a footnote.`;
    case "Work authorization":
      return `Confirmed right to work for the target market before the candidate reaches your shortlist.`;
    case "Language":
      return `Working-level languages captured in the workspace so client-facing ${industryName} roles never slip through.`;
    case "Availability":
      return `Notice period, start date and interview capacity reviewed up front — no wasted rounds on unavailable candidates.`;
    default:
      return `${category} reviewed as part of every ${industryName} shortlist.`;
  }
}
