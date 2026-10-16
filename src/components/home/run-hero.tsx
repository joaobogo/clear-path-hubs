import { Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { Pause, Play, RotateCcw, ArrowUpRight } from "lucide-react";
import { RunButton } from "@/components/system/run-button";
import { usePrefersReducedMotion } from "@/lib/motion/use-motion";
import { ConvergenceField } from "@/components/signature/convergence-field";
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
import { FIELD_GATES, type Point } from "@/lib/run/field";
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

const RUN_COUNTS = PREVIEW_RUN_FUNNEL.map((s) => s.count) as [number, number, number, number];

/**
 * Where each count lands as the field's front travels: the reach count as the
 * lines enter, the next two at their gates, the signed count when the ten
 * lines land on the names.
 */
const COUNT_LANDS_AT = [0.12, FIELD_GATES[0], FIELD_GATES[1], 1] as const;

function countAt(count: number, front: number, landsAt: number): number {
  if (front >= landsAt) return count;
  const t = front / landsAt;
  return Math.round(count * t * t);
}

export function RunHero({ role, onRun }: { role?: string; onRun?: (role: string) => void }) {
  const roleTitle = role || SAMPLE_SHORTLIST_ROLE;
  const hostRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  // Full counts before scripts run; the field then ticks them in as it draws.
  const [front, setFront] = useState(1);
  const [paused, setPaused] = useState(false);
  const [replay, setReplay] = useState(0);
  const [selectedRef, setSelectedRef] = useState(SAMPLE_SHORTLIST[0]?.ref ?? "");
  const selected = SAMPLE_SHORTLIST.find((candidate) => candidate.ref === selectedRef);
  const reduced = usePrefersReducedMotion();

  // Below 1024 the list sits under the text; the field is confined to the
  // band from just above the list to its last row, so the headline, the
  // paragraph and the input stay on plain white.
  const getFrame = useCallback(() => {
    const host = hostRef.current;
    const list = listRef.current;
    if (!host || !list || host.getBoundingClientRect().width >= 1024) return null;
    const h = host.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    const top = Math.max(0, l.top - h.top - 72);
    return { top, height: l.bottom - h.top - top };
  }, []);

  const getTargets = useCallback((): Point[] => {
    const host = hostRef.current?.getBoundingClientRect();
    if (!host) return [];
    return rowRefs.current.flatMap((li) => {
      if (!li) return [];
      const r = li.getBoundingClientRect();
      return [{ x: r.left - host.left, y: r.top - host.top + r.height / 2 }];
    });
  }, []);
  const [agentsLine, peopleLine] = [
    `${offer.agents} agents open it on ${offer.channels} channels the same day and score every applicant against your rubric.`,
    "A senior recruiter signs the ten worth interviewing. One flat fee.",
  ];

  return (
    <section ref={hostRef} aria-labelledby="run-hero-title" className="day relative overflow-hidden">
      <ConvergenceField
        seed={roleTitle}
        counts={RUN_COUNTS}
        getTargets={getTargets}
        getFrame={getFrame}
        onFront={setFront}
        stillSrc="/run-field.png"
        paused={paused}
        replay={replay}
      />
      <div className="relative z-10 mx-auto w-full max-w-[calc(var(--max)+2*var(--margin))] px-[var(--margin)]">
        <div className="grid gap-12 pt-14 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16 lg:pt-20">
          <div className="min-w-0 max-w-[800px]">
            <h1
              id="run-hero-title"
              className="run-hero-heading display text-[36px] text-[color:var(--ink)] [text-wrap:balance] min-[400px]:text-[44px] sm:text-[64px] xl:text-[80px]"
            >
              Post the role. Sourcing agents deliver your shortlist.
            </h1>
            <p className="run-hero-lead mt-6 max-w-[640px] text-[19px] leading-[1.55] text-[color:var(--slate)] sm:text-[21px]">
              {agentsLine} {peopleLine}
            </p>
            <div className="mt-10 max-w-[590px]">
              <RoleInput
                source="home_hero"
                defaultRole={role ?? ""}
                suggestions={ROLE_SUGGESTIONS}
                onRun={onRun}
                className="border-[color:var(--blue-200)] [box-shadow:0_18px_40px_-24px_var(--blue-300)]"
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link to="/how-it-works" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[color:var(--blue-600)]">How a role runs <ArrowUpRight className="size-4" aria-hidden /></Link>
              {!reduced ? <div className="flex items-center gap-1" aria-label="Line animation">
                <RunButton variant="ghost" size="sm" className="size-11 min-h-11 border-0 p-0" aria-label={paused ? "Play line animation" : "Pause line animation"} title={paused ? "Play line animation" : "Pause line animation"} onClick={() => setPaused((value) => !value)}>{paused ? <Play className="size-4" /> : <Pause className="size-4" />}</RunButton>
                <RunButton variant="ghost" size="sm" className="size-11 min-h-11 border-0 p-0" aria-label="Replay line animation" title="Replay line animation" onClick={() => { setPaused(false); setReplay((value) => value + 1); }}><RotateCcw className="size-4" /></RunButton>
              </div> : null}
            </div>
          </div>

          <aside ref={listRef} aria-labelledby="run-hero-list-title" className="min-w-0">
            <div className="flex items-baseline justify-between border-b border-[color:var(--ink)] pb-2">
              <h2 id="run-hero-list-title" className="text-base font-semibold [font-stretch:100%] text-[color:var(--ink)]">
                Top 10 · {roleTitle}
              </h2>
              <span className="narrow text-[13px] font-medium text-[color:var(--faint)]">
                {REPRESENTATIVE_LABEL}
              </span>
            </div>
            <ol className="divide-y divide-[color:var(--rule)]">
              {SAMPLE_SHORTLIST.map((c, i) => (
                <li
                  key={c.ref}
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  className="h-11"
                >
                  <RunButton variant="ghost" size="sm" aria-pressed={selectedRef === c.ref} aria-label={`View evidence for ${c.ref.replace(/^Example candidate /, "Candidate ")}`} onClick={() => setSelectedRef(c.ref)} className={cn("hero-candidate h-11 w-full min-h-11 justify-start gap-3 rounded-none border-0 px-0", selectedRef === c.ref && "is-selected")}>
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
                  </RunButton>
                </li>
              ))}
            </ol>
            <div className="hero-evidence mt-3 min-h-[148px] border-l-2 border-primary p-4" aria-live="polite" aria-atomic="true">
              <p className="text-xs font-semibold text-[color:var(--blue-600)]">{selected?.ref.replace(/^Example candidate /, "Candidate ")} · evidence from the CV</p>
              <p className="mt-2 whitespace-normal text-sm font-normal leading-relaxed text-[color:var(--ink)]">{selected?.results.licence.evidence}</p>
            </div>
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

        {/* Proof bar: track record, not a sample funnel. */}
        <div className="mt-14 border-t border-[color:var(--ink)] pt-4">
          <p className="narrow text-[13px] font-semibold uppercase tracking-[0.12em] text-[color:var(--blue-600)]">
            Proof of concept
          </p>
          <dl
            aria-label="Track record"
            className="mt-2 grid min-h-[112px] grid-cols-2 lg:grid-cols-4"
          >
            {[
              { value: "4", label: "Continents hired across" },
              { value: "8+", label: "Languages recruited in" },
              { value: "500+", label: "Positions run" },
              { value: "0", label: "Positions left unfilled" },
            ].map((item, i) => (
              <div
                key={item.label}
                className={cn(
                  "flex flex-col justify-center gap-1 py-5 pr-4",
                  i > 0 && "border-l border-[color:var(--rule)] pl-5",
                  i === 2 && "max-lg:border-l-0 max-lg:pl-0",
                )}
              >
                <dd
                  className={cn(
                    "wide num order-2 text-[40px] font-semibold leading-none sm:text-[52px]",
                    i === 3 ? "text-[color:var(--ink)]" : "text-[color:var(--blue-600)]",
                  )}
                >
                  {item.value}
                </dd>
                <dt className="narrow order-1 text-[13px] font-medium text-[color:var(--faint)]">{item.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
