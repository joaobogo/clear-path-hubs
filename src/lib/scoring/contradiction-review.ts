/**
 * Contradictions as review tasks — Prompt 26.
 *
 * A contradiction status on a record is not actionable. A reviewer needs both
 * quoted sources side by side, and a way to say which one is right — or that
 * both can be true. Nothing here picks a side, and nothing blocks without an
 * available resolution.
 */

export type ContradictionKind =
  | "dates_overlap"
  | "title_mismatch"
  | "tenure_mismatch"
  | "employer_mismatch"
  | "skill_claim_unsupported"
  | "location_mismatch";

export type QuotedSource = {
  /** Where it came from, in words a reviewer recognises. */
  document_label: string;
  /** Verbatim passage. Never paraphrased, never stitched from two places. */
  passage: string;
  /** Page or section, when known. */
  location?: string | null;
  /** Self-reported sources are labelled as such and never read as verified. */
  self_reported?: boolean;
};

export type ContradictionTask = {
  id: string;
  kind: ContradictionKind;
  /** The question the reviewer answers, in one sentence. */
  question: string;
  left: QuotedSource;
  right: QuotedSource;
  /** Every choice offered, including "both can be true". */
  resolutions: ContradictionResolution[];
  resolved?: ContradictionOutcome | null;
};

export type ContradictionResolution = {
  code: "prefer_left" | "prefer_right" | "both_true" | "needs_candidate_input";
  label: string;
};

export type ContradictionOutcome = {
  code: ContradictionResolution["code"];
  /** A reason is required; there is no silent resolution. */
  reason: string;
  resolved_by: string;
  resolved_at: string;
};

const QUESTIONS: Record<ContradictionKind, string> = {
  dates_overlap: "These two roles overlap in time. Which reading is correct?",
  title_mismatch: "The job title differs between these sources. Which should we use?",
  tenure_mismatch: "The length of time in this role differs. Which is correct?",
  employer_mismatch: "The employer name differs between these sources. Which is correct?",
  skill_claim_unsupported:
    "This skill is claimed in one place and not evidenced in the other. How should we read it?",
  location_mismatch: "The location differs between these sources. Which is correct?",
};

export function buildContradictionTask(input: {
  id: string;
  kind: ContradictionKind;
  left: QuotedSource;
  right: QuotedSource;
  resolved?: ContradictionOutcome | null;
}): ContradictionTask {
  return {
    id: input.id,
    kind: input.kind,
    question: QUESTIONS[input.kind],
    left: input.left,
    right: input.right,
    resolutions: [
      { code: "prefer_left", label: `Use what ${input.left.document_label} says` },
      { code: "prefer_right", label: `Use what ${input.right.document_label} says` },
      { code: "both_true", label: "Both can be true — keep them and note it" },
      { code: "needs_candidate_input", label: "Ask the candidate to clarify" },
    ],
    resolved: input.resolved ?? null,
  };
}

/** Reviewer-facing note on a source, so self-reported never reads as verified. */
export function sourceCaption(source: QuotedSource): string {
  const where = source.location ? ` · ${source.location}` : "";
  const kind = source.self_reported ? " · self-reported" : "";
  return `${source.document_label}${where}${kind}`;
}

export function openTasks(tasks: ContradictionTask[]): ContradictionTask[] {
  return tasks.filter((t) => !t.resolved);
}

/**
 * Contradictions inform the reviewer; they never move a candidate on their own.
 * An unresolved contradiction shows on the score as a named uncertainty.
 */
export function contradictionNotice(tasks: ContradictionTask[]): string | null {
  const open = openTasks(tasks);
  if (open.length === 0) return null;
  return open.length === 1
    ? "One detail in this profile contradicts itself and needs a human read."
    : `${open.length} details in this profile contradict themselves and need a human read.`;
}
