import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Chapter } from "@/components/home/chapters/chapter";
import { EvidenceStrip, type EvidenceState } from "@/components/signature/evidence-strip";
import { Seal } from "@/components/signature/seal";
import { RUN_CHAPTERS } from "@/config/run-chapters";
import {
  PREVIEW_RUN_SIGNED_AT,
  SAMPLE_RECRUITER_NOTES,
  SAMPLE_RECRUITER_SIGN_OFF,
  SAMPLE_SHORTLIST,
  SAMPLE_SHORTLIST_REQUIREMENTS,
} from "@/lib/previews/representative-fixtures";
import { cn } from "@/lib/utils";

const chapter = RUN_CHAPTERS[3]!;
const UNDO_SECONDS = 5 * 60;

function evidenceState(score: number): EvidenceState {
  if (score >= 80) return "quote";
  if (score >= 65) return "question";
  return "none";
}

type Decision = "accepted" | "declined";

/** "Undo for 4:59": a decision can be reversed for five minutes. */
function Undo({ since, onUndo }: { since: number; onUndo: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, UNDO_SECONDS - Math.floor((now - since) / 1000));
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, "0");
  if (left === 0) return null;
  return (
    <button
      type="button"
      onClick={onUndo}
      className="num inline-flex min-h-10 items-center text-sm font-medium text-[color:var(--ink)] underline underline-offset-4"
    >
      Undo for {m}:{s}
    </button>
  );
}

const decisionButton =
  "inline-flex min-h-10 items-center justify-center rounded-[var(--r-1)] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[color:var(--blue-600)]";

function DecisionCell({
  decision,
  onDecide,
  onUndo,
}: {
  decision?: { d: Decision; at: number };
  onDecide: (d: Decision) => void;
  onUndo: () => void;
}) {
  if (decision) {
    return (
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold",
            decision.d === "accepted" ? "bg-[color:var(--ink)] text-white" : "border border-[color:var(--rule-2)] text-[color:var(--slate)]",
          )}
        >
          {decision.d === "accepted" ? "Accepted" : "Declined"}
        </span>
        <Undo since={decision.at} onUndo={onUndo} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onDecide("accepted")} className={cn(decisionButton, "bg-[color:var(--blue-600)] text-white hover:bg-[color:var(--blue-700)]")}>
        Accept
      </button>
      <button type="button" onClick={() => onDecide("declined")} className={cn(decisionButton, "border border-[color:var(--rule-2)] text-[color:var(--ink)] hover:bg-[color:var(--blue-50)]")}>
        Decline
      </button>
    </div>
  );
}

/**
 * Chapter 4, Sign-off (Day 5, 09:00, white). A person read the list and put
 * their name on it: the recruiter's note in an ink-bordered band with the
 * seal, then five of the ten as a real table with the two decisions.
 */
export function ChapterSignOff() {
  const [decisions, setDecisions] = useState<Record<string, { d: Decision; at: number }>>({});
  const decide = (ref: string, d: Decision) => setDecisions((s) => ({ ...s, [ref]: { d, at: Date.now() } }));
  const undo = (ref: string) =>
    setDecisions((s) => {
      const next = { ...s };
      delete next[ref];
      return next;
    });

  return (
    <Chapter
      chapter={chapter}
      index={4}
      title="Ten people, read and signed."
      lead="A senior recruiter reads every finalist, writes a note on each and signs the list before it reaches you."
    >
      <div className="border-2 border-[color:var(--ink)] p-6 sm:flex sm:items-start sm:justify-between sm:gap-10 sm:p-8">
        <blockquote className="max-w-[640px] text-[17px] leading-[1.55] text-[color:var(--ink)]">{SAMPLE_RECRUITER_SIGN_OFF}</blockquote>
        <Seal what="Top 10 signed off" at={PREVIEW_RUN_SIGNED_AT} className="mt-6 shrink-0 sm:mt-0" />
      </div>

      {/* A phone turns the six-column table into cards; the table stays for assistive tech from 768 up. */}
      <ul className="mt-10 flex flex-col divide-y divide-[color:var(--rule)] md:hidden" aria-label="Five of the ten signed candidates, example data">
        {SAMPLE_SHORTLIST.slice(0, 5).map((c, i) => {
          const states = SAMPLE_SHORTLIST_REQUIREMENTS.map((q) => evidenceState(c.results[q.key].score));
          const decision = decisions[c.ref];
          return (
            <li key={c.ref} className="py-4">
              <div className="flex items-center gap-3">
                <span className="narrow num text-[13px] text-[color:var(--faint)]">{c.rank}</span>
                <span className="flex-1 text-[15px] font-medium text-[color:var(--ink)]">{c.ref.replace(/^Example candidate /, "Candidate ")}</span>
                <EvidenceStrip size="card" states={states} />
                <span className="wide num text-base font-semibold text-[color:var(--ink)]">{c.score}</span>
              </div>
              <p className="mt-2 text-[15px] text-[color:var(--slate)]">{SAMPLE_RECRUITER_NOTES[i]}</p>
              <div className="mt-3">
                <DecisionCell decision={decision} onDecide={(d) => decide(c.ref, d)} onUndo={() => undo(c.ref)} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 hidden md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Five of the ten signed candidates, example data</caption>
          <thead>
            <tr className="narrow border-b border-[color:var(--ink)] text-[13px] font-medium text-[color:var(--faint)]">
              <th scope="col" className="py-2 pr-3 font-medium">#</th>
              <th scope="col" className="py-2 pr-3 font-medium">Candidate</th>
              <th scope="col" className="py-2 pr-3 font-medium">Evidence</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Score</th>
              <th scope="col" className="py-2 pr-3 font-medium">Recruiter's note</th>
              <th scope="col" className="py-2 font-medium">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--rule)]">
            {SAMPLE_SHORTLIST.slice(0, 5).map((c, i) => {
              const states = SAMPLE_SHORTLIST_REQUIREMENTS.map((q) => evidenceState(c.results[q.key].score));
              const decision = decisions[c.ref];
              return (
                <tr key={c.ref} className="h-14 align-middle">
                  <td className="narrow num pr-3 text-[13px] text-[color:var(--faint)]">{c.rank}</td>
                  <td className="pr-3 text-[15px] font-medium text-[color:var(--ink)]">{c.ref.replace(/^Example candidate /, "Candidate ")}</td>
                  <td className="pr-3"><EvidenceStrip size="card" states={states} /></td>
                  <td className="wide num pr-3 text-right text-base font-semibold text-[color:var(--ink)]">{c.score}</td>
                  <td className="max-w-[300px] pr-3 text-[15px] text-[color:var(--slate)]">{SAMPLE_RECRUITER_NOTES[i]}</td>
                  <td>
                    <DecisionCell decision={decision} onDecide={(d) => decide(c.ref, d)} onUndo={() => undo(c.ref)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-[15px] text-[color:var(--slate)]">
        Decisions here are a demonstration; in the workspace each one can be undone for five minutes.{" "}
        <Link to="/sample-shortlist" className="font-medium text-[color:var(--blue-600)] underline underline-offset-4">
          See a sample top 10
        </Link>{" "}
        with every note.
      </p>
    </Chapter>
  );
}
