import { ArrowRight, Minus, Check } from "lucide-react";
import { PublicPage, PublicSection } from "@/components/marketing/site-shell";

/**
 * "What you keep missing with the old model."
 *
 * Premium contrast section. No cheap urgency, no fear-mongering.
 * Just a tangible side-by-side of what the legacy model quietly costs
 * and what TaaSFlow returns — six paired lines.
 */

const PAIRS: { old: string; oldNote: string; taas: string; taasNote: string }[] = [
  {
    old: "Hidden agency cost",
    oldNote: "20–30% of first-year salary per hire, invoiced only when it's too late to renegotiate.",
    taas: "One flat monthly fee",
    taasNote: "Same tier whether you hire one candidate or five — priced upfront, cancel anytime.",
  },
  {
    old: "Invisible sourcing work",
    oldNote: "You never see who was contacted, why, or which profiles were declined.",
    taas: "Sourcing shown in the workspace",
    taasNote: "Every candidate, every stage, every rubric score — visible to your team in real time.",
  },
  {
    old: "Lost pipeline context",
    oldNote: "When the agency changes recruiter, the reasoning behind each candidate resets to zero.",
    taas: "Reasoning stays with the record",
    taasNote: "Evidence, notes, and stage history persist against the candidate, not the recruiter.",
  },
  {
    old: "Repeated fees",
    oldNote: "The same candidate re-submitted next quarter triggers a new placement fee.",
    taas: "Reusable candidate pool",
    taasNote: "Silver-medalists remain yours. Bring them back on the next role at no additional cost.",
  },
  {
    old: "No shared decision record",
    oldNote: "Approvals live in email threads and Slack DMs — impossible to audit later.",
    taas: "One decision log per role",
    taasNote: "Every stage transition is timestamped and attributable, ready for internal review.",
  },
  {
    old: "Delayed hiring velocity",
    oldNote: "Days lost re-briefing new recruiters and re-explaining what \"good\" looks like.",
    taas: "Rubric locked in intake",
    taasNote: "The definition of a strong candidate is signed off once and reused across the search.",
  },
];

export function HiddenCostOfWaiting() {
  return (
    <PublicSection
      aria-labelledby="hidden-cost-heading"
      className="bg-[color:var(--brand-navy)] text-white"
    >
      <PublicPage>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-sand)]">
            The status quo tax
          </p>
          <h2
            id="hidden-cost-heading"
            className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            What you keep missing with the old model.
          </h2>
          <p className="mt-3 text-white/70">
            None of these are hypothetical. They're the recurring line-items every
            operator we've spoken to describes when the search finally closes — and
            the reason a subscription model exists in the first place.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-white/10">
          {/* Column headers */}
          <div className="grid grid-cols-1 border-b border-white/10 bg-white/5 md:grid-cols-2">
            <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Old model
              </p>
              <p className="mt-1 text-sm text-white/70">
                Contingency agency + fragmented tools
              </p>
            </div>
            <div className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-sand)]">
                TaaSFlow
              </p>
              <p className="mt-1 text-sm text-white/80">
                One workspace, one team, one system
              </p>
            </div>
          </div>

          <ul>
            {PAIRS.map((p, i) => (
              <li
                key={p.old}
                className={`grid grid-cols-1 md:grid-cols-2 ${
                  i !== PAIRS.length - 1 ? "border-b border-white/10" : ""
                }`}
              >
                <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/40"
                      aria-hidden
                    >
                      <Minus className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold text-white">{p.old}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/60">
                        {p.oldNote}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-sand)]/20 text-[color:var(--brand-sand)]"
                      aria-hidden
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold text-white">{p.taas}</p>
                      <p className="mt-1 text-sm leading-relaxed text-white/75">
                        {p.taasNote}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-white/60">
            The old model isn't broken. It's just expensive in ways that only show
            up at the end of the quarter.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand-navy)] transition hover:bg-[color:var(--brand-sand)]"
          >
            View Pricing <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </PublicPage>
    </PublicSection>
  );
}
