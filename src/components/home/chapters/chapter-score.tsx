import { useLayoutEffect, useRef, useState } from "react";
import { Chapter } from "@/components/home/chapters/chapter";
import { RUN_CHAPTERS } from "@/config/run-chapters";
import {
  SAMPLE_CV_EXCERPT,
  SAMPLE_RUBRIC_WEIGHTS,
  SAMPLE_SHORTLIST,
  SAMPLE_SHORTLIST_REQUIREMENTS,
  type SampleRequirementKey,
} from "@/lib/previews/representative-fixtures";
import { cn } from "@/lib/utils";

const chapter = RUN_CHAPTERS[2]!;
const top = SAMPLE_SHORTLIST[0]!;
/** The three heaviest requirements, the same three the Brief chapter's sliders carry. */
const SHOWN = SAMPLE_SHORTLIST_REQUIREMENTS.slice(0, 3);
const SHOWN_KEYS = new Set<SampleRequirementKey>(SHOWN.map((q) => q.key));

/**
 * Chapter 3, Score (Days 1 to 4, tint). A CV on white paper, on the pale
 * blue that means agents are working. Sentences that earned points are
 * highlighted and wired to their requirement; the one with no sentence is
 * named as a question to ask, as prominently as the hits.
 */
export function ChapterScore() {
  const [active, setActive] = useState<SampleRequirementKey | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [wire, setWire] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const quoted = new Set(SAMPLE_CV_EXCERPT.filter((s) => s.requirement && SHOWN_KEYS.has(s.requirement)).map((s) => s.requirement!));

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !active || !quoted.has(active)) {
      setWire(null);
      return;
    }
    const sentence = host.querySelector<HTMLElement>(`[data-sentence="${active}"]`);
    const row = host.querySelector<HTMLElement>(`[data-requirement="${active}"]`);
    if (!sentence || !row) {
      setWire(null);
      return;
    }
    const h = host.getBoundingClientRect();
    const s = sentence.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    setWire({ x1: s.right - h.left, y1: s.top - h.top + s.height / 2, x2: r.left - h.left, y2: r.top - h.top + r.height / 2 });
  }, [active]);

  return (
    <Chapter
      chapter={chapter}
      index={3}
      title="Every score points at a sentence."
      lead="Agents read each CV against your rubric and quote the line that earned the points. Where the CV is silent, the gap is named."
    >
      <div ref={hostRef} className="relative grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
        {wire ? (
          <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block">
            <path
              d={`M${wire.x1} ${wire.y1} C ${(wire.x1 + wire.x2) / 2} ${wire.y1}, ${(wire.x1 + wire.x2) / 2} ${wire.y2}, ${wire.x2} ${wire.y2}`}
              pathLength={1}
              fill="none"
              stroke="var(--blue-600)"
              strokeWidth="1.5"
              className="run-wire"
            />
          </svg>
        ) : null}

        <article className="paper bg-white p-7 sm:p-9" aria-label="CV excerpt, example data">
          <p className="narrow text-[13px] font-medium text-[color:var(--faint)]">{top.ref} · CV excerpt · example data</p>
          <p className="mt-4 text-[17px] leading-[1.7] text-[color:var(--ink)]">
            {SAMPLE_CV_EXCERPT.map((s, i) => {
              const key = s.requirement && SHOWN_KEYS.has(s.requirement) ? s.requirement : undefined;
              const lit = key !== undefined && active === key;
              const dim = active !== null && !lit;
              return (
                <span
                  key={i}
                  data-sentence={key}
                  className={cn(
                    "transition-[background-color,opacity] duration-[var(--t-quick)] ease-[var(--ease)]",
                    // A quoted sentence is underlined in blue until its requirement is hovered; then it lights.
                    key && "box-decoration-clone underline decoration-[color:var(--blue-300)] decoration-2 underline-offset-4",
                    lit && "rounded-[3px] bg-[color:var(--blue-100)] px-0.5 no-underline",
                    dim && "opacity-40",
                  )}
                >
                  {s.text}{" "}
                </span>
              );
            })}
          </p>
        </article>

        <ol className="flex flex-col divide-y divide-[color:var(--line)]" aria-label="Requirements and the sentence behind each">
          {SHOWN.map((q) => {
            const result = top.results[q.key];
            const sentence = SAMPLE_CV_EXCERPT.find((s) => s.requirement === q.key);
            const isActive = active === q.key;
            return (
              <li
                key={q.key}
                data-requirement={q.key}
                onMouseEnter={() => setActive(q.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(q.key)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                className={cn(
                  "py-4 outline-none transition-opacity duration-[var(--t-quick)]",
                  active !== null && !isActive && "opacity-40",
                  "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[color:var(--blue-600)]",
                )}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-semibold text-[color:var(--text)]">{q.label}</p>
                  <p className="num shrink-0 text-sm text-[color:var(--text-3)]">
                    {SAMPLE_RUBRIC_WEIGHTS[q.key]}% ·{" "}
                    <span className="wide text-base font-semibold text-[color:var(--action)]">{sentence ? result.score : "—"}</span>
                  </p>
                </div>
                {sentence ? (
                  <blockquote className="mt-1.5 text-[15px] text-[color:var(--text-2)]">“{sentence.text}”</blockquote>
                ) : (
                  <p className="mt-1.5 text-[15px] text-[color:var(--text)]">
                    <span className="font-semibold">No sentence found.</span> {result.evidence}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </Chapter>
  );
}
