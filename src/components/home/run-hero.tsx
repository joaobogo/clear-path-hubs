import { Link } from "@tanstack/react-router";
import { EvidenceStrip, type EvidenceState } from "@/components/signature/evidence-strip";
import { RoleInput } from "@/components/system/role-input";
import { offer } from "@/config/offer";
import { ROLE_SUGGESTIONS } from "@/config/role-suggestions";
import {
  PREVIEW_RUN_FUNNEL,
  PREVIEW_RUN_SIGNED_AT,
  REPRESENTATIVE_LABEL,
  SAMPLE_SHORTLIST,
  SAMPLE_SHORTLIST_REQUIREMENTS,
  SAMPLE_SHORTLIST_ROLE,
} from "@/lib/previews/representative-fixtures";
import { cn } from "@/lib/utils";

/**
 * The homepage hero (The Run, cold open). White. Headline, the role input,
 * the top-10 list on the right and the run bar along the bottom. Headline,
 * input and list are real text and readable before any canvas loads; the
 * convergence field is drawn behind this, later, and hidden from assistive
 * tech.
 */

/** A requirement score reads as evidence found, a question to ask, or nothing. */
function evidenceState(score: number): EvidenceState {
  if (score >= 80) return "quote";
  if (score >= 65) return "question";
  return "none";
}

const nf = new Intl.NumberFormat("en-US");

export function RunHero({ role }: { role?: string }) {
  const roleTitle = role || SAMPLE_SHORTLIST_ROLE;
  const [agentsLine, peopleLine] = [
    `${offer.agents} agents open it on ${offer.channels} channels the same day and score every applicant against your rubric.`,
    "A senior recruiter signs the ten worth interviewing. One flat fee.",
  ];

  return (
    <section aria-labelledby="run-hero-title" className="day relative overflow-hidden">
      <div className="mx-auto w-full max-w-[calc(var(--max)+2*var(--margin))] px-[var(--margin)]">
        <div className="grid gap-12 pt-14 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16 lg:pt-20">
          <div className="min-w-0 max-w-[800px]">
            <h1
              id="run-hero-title"
              className="display text-[clamp(44px,6vw,86px)] text-[color:var(--ink)]"
            >
              Everyone hears about your role. You meet ten.
            </h1>
            <p className="mt-6 max-w-[640px] text-[21px] leading-[1.45] text-[color:var(--slate)]">
              {agentsLine} {peopleLine}
            </p>
            <div className="mt-10 max-w-[590px]">
              <RoleInput
                source="home_hero"
                defaultRole={role ?? ""}
                suggestions={ROLE_SUGGESTIONS}
                className="border-[color:var(--blue-200)] [box-shadow:0_18px_40px_-24px_var(--blue-300)]"
              />
            </div>
          </div>

          <aside aria-labelledby="run-hero-list-title" className="min-w-0">
            <div className="flex items-baseline justify-between border-b border-[color:var(--ink)] pb-2">
              <h2 id="run-hero-list-title" className="text-base font-semibold [font-stretch:100%] text-[color:var(--ink)]">
                Top 10 · {roleTitle}
              </h2>
              <span className="narrow text-[13px] font-medium text-[color:var(--faint)]">
                {REPRESENTATIVE_LABEL}
              </span>
            </div>
            <ol className="divide-y divide-[color:var(--rule)]">
              {SAMPLE_SHORTLIST.map((c) => (
                <li key={c.ref} className="flex h-11 items-center gap-3">
                  <span className="narrow num w-5 text-[13px] font-medium text-[color:var(--faint)]">
                    {c.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] text-[color:var(--ink)]">
                    {c.ref.replace(/^Example candidate /, "Candidate ")}
                  </span>
                  <EvidenceStrip
                    size="table"
                    states={SAMPLE_SHORTLIST_REQUIREMENTS.map((q) => evidenceState(c.results[q.key].score))}
                  />
                  <span className="wide num w-8 text-right text-[15px] font-semibold text-[color:var(--ink)]">
                    {c.score}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-[color:var(--slate)]">
              <Link
                to="/sample-shortlist"
                className="inline-flex min-h-11 items-center font-medium text-[color:var(--blue-600)] underline underline-offset-4"
              >
                See a sample top 10
              </Link>
              <span className="ml-2 text-[color:var(--faint)]">with every quote.</span>
            </p>
          </aside>
        </div>

        {/* The run bar: four counts in one order. The first three are agent
            work, the last is a person's. */}
        <dl
          aria-label="One run, as four counts"
          className="mt-14 grid min-h-[112px] grid-cols-2 border-t border-[color:var(--ink)] lg:grid-cols-4"
        >
          {PREVIEW_RUN_FUNNEL.map((stage, i) => {
            const human = stage.key === "signed";
            return (
              <div
                key={stage.key}
                className={cn(
                  "flex flex-col justify-center gap-1 py-5 pr-4",
                  i > 0 && "border-l border-[color:var(--rule)] pl-5",
                  i === 2 && "lg:border-l",
                  i === 1 && "border-l",
                )}
              >
                <dt className="narrow text-[13px] font-medium text-[color:var(--faint)]">
                  {stage.label}
                  {human ? ` · ${PREVIEW_RUN_SIGNED_AT}` : ""}
                </dt>
                <dd
                  className={cn(
                    "wide num text-[40px] font-semibold leading-none sm:text-[52px]",
                    human ? "text-[color:var(--ink)]" : "text-[color:var(--blue-600)]",
                  )}
                >
                  {nf.format(stage.count)}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
