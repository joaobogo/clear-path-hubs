import { useMemo, useState } from "react";
import { Chapter } from "@/components/home/chapters/chapter";
import { RunLinkButton } from "@/components/system/run-button";
import { WeightSlider } from "@/components/system/weight-slider";
import { RUN_CHAPTERS } from "@/config/run-chapters";
import {
  SAMPLE_RUBRIC_WEIGHTS,
  SAMPLE_SHORTLIST,
  SAMPLE_SHORTLIST_REQUIREMENTS,
} from "@/lib/previews/representative-fixtures";
import { rebalance, weightedScore } from "@/lib/run/rubric";

const chapter = RUN_CHAPTERS[0]!;
const REQS = SAMPLE_SHORTLIST_REQUIREMENTS;
const SLIDER_COUNT = 3;

/** The three documents a buyer approves before anything is sourced. */
const DOCUMENTS = [
  { title: "Role blueprint", line: "What the role is for, in the words you confirmed." },
  { title: "Scoring rubric", line: "The weights above, locked as a version. Every candidate is read against the same one." },
  { title: "Sourcing plan", line: "Which channels open, in what order, and what the outreach says." },
] as const;

/**
 * Chapter 1, Brief (Day 0, 09:00, white). The buyer sets the standard before
 * anything is sourced. Three weighted requirements on sliders, the rest as
 * chips; dragging one rebalances the others to keep 100 and redraws the
 * score bar.
 */
export function ChapterBrief({ role }: { role: string }) {
  const [sliders, setSliders] = useState<number[]>(() => REQS.slice(0, SLIDER_COUNT).map((q) => SAMPLE_RUBRIC_WEIGHTS[q.key]));
  const chips = REQS.slice(SLIDER_COUNT);
  const fixed = chips.reduce((a, q) => a + SAMPLE_RUBRIC_WEIGHTS[q.key], 0);
  const weights = [...sliders, ...chips.map((q) => SAMPLE_RUBRIC_WEIGHTS[q.key])];
  const total = weights.reduce((a, b) => a + b, 0);

  const top = SAMPLE_SHORTLIST[0]!;
  const score = useMemo(
    () => weightedScore(REQS.map((q) => top.results[q.key].score), weights),
    // weights is derived from sliders; the chips never change
    [sliders.join(",")],
  );

  return (
    <Chapter
      chapter={chapter}
      index={1}
      title="You decide what good looks like."
      lead="Drop in the job description. It becomes a weighted rubric, and a recruiter confirms it with you within one business day."
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between border-b border-[color:var(--ink)] pb-3">
            <h3 className="text-[22px] text-[color:var(--ink)]">{role}</h3>
            <p className="num text-sm text-[color:var(--slate)]">
              Weights total <span className="font-semibold text-[color:var(--ink)]">{total}</span>
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-6">
            {REQS.slice(0, SLIDER_COUNT).map((q, i) => (
              <WeightSlider
                key={q.key}
                label={q.label}
                value={sliders[i]!}
                min={0}
                max={100 - fixed}
                onChange={(v) => setSliders((s) => rebalance(s, i, v, fixed))}
                format={(v) => `${v}%`}
                valueText={`${sliders[i]} percent of the score`}
              />
            ))}
          </div>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Smaller requirements">
            {chips.map((q) => (
              <li
                key={q.key}
                className="inline-flex h-8 items-center gap-2 rounded-full border border-[color:var(--rule-2)] px-3 text-sm text-[color:var(--ink)]"
              >
                {q.label}
                <span className="num font-semibold text-[color:var(--blue-600)]">{SAMPLE_RUBRIC_WEIGHTS[q.key]}%</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 border-t border-[color:var(--rule)] pt-5">
            <div className="flex items-baseline justify-between">
              <p className="text-[15px] text-[color:var(--slate)]">Top example candidate on these weights</p>
              <p className="wide num text-[28px] font-semibold leading-none text-[color:var(--blue-600)]" aria-live="polite">
                {score}
              </p>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-[color:var(--blue-100)]" aria-hidden>
              <div
                className="h-2 rounded-full bg-[color:var(--blue-600)] transition-[width] duration-[var(--t-base)] ease-[var(--ease)]"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>

        <div className="tint min-w-0 rounded-[var(--r-3)] p-6 sm:p-8">
          <p className="narrow text-[13px] font-medium text-[color:var(--text-3)]">You approve three documents</p>
          <ol className="mt-4 divide-y divide-[color:var(--line)]">
            {DOCUMENTS.map((d, i) => (
              <li key={d.title} className="flex gap-4 py-4">
                <span className="narrow num w-5 shrink-0 text-[13px] text-[color:var(--text-3)]">{i + 1}</span>
                <div>
                  <p className="font-semibold text-[color:var(--text)]">{d.title}</p>
                  <p className="mt-1 text-[15px] text-[color:var(--text-2)]">{d.line}</p>
                </div>
              </li>
            ))}
          </ol>
          <RunLinkButton to="/" hash="chapter-broadcast" resetScroll={false} className="mt-6">
            Approve the brief
          </RunLinkButton>
        </div>
      </div>
    </Chapter>
  );
}
