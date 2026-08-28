/**
 * How a requirement becomes a "strength".
 *
 * This used to live inline in the scoring engine and accepted only `met`, the
 * engine's strict keyword-count status. The Evidence tab uses a different
 * classifier (src/lib/evidence/completeness.ts), which calls a criterion
 * "evidenced" once it has two supporting quotes. The two disagreed constantly:
 * a candidate could read "3 of 7 must-have criteria fully evidenced" on one tab
 * and "Strengths: None surfaced." on the next.
 *
 * A requirement we captured evidence for is a strength. If that evidence has
 * not cleared the engine's bar it is a qualified one, and it says so — it still
 * appears under Concerns as something to confirm. What it must never do is
 * vanish, leaving a scored candidate with nothing positive recorded at all.
 *
 * Shared deliberately: the engine writes this into new score runs, and the
 * admin UI applies the same rule to runs written before this existed, so old
 * candidates read correctly without being rescored. Score runs are immutable —
 * nothing here changes a stored number.
 */

export type StrengthAssessmentRow = {
  text: string;
  status: "met" | "partial" | "missing" | "unknown" | "contradicted";
  evidence?: unknown[] | null;
};

/** Default number of strengths shown. Matches the concerns list. */
export const STRENGTH_LIMIT = 5;

function hasEvidence(row: StrengthAssessmentRow): boolean {
  return Array.isArray(row.evidence) && row.evidence.length > 0;
}

/**
 * Strengths for a requirement assessment, fully met first.
 * Empty only when genuinely nothing was evidenced.
 */
export function deriveStrengths(
  assessment: readonly StrengthAssessmentRow[],
  limit: number = STRENGTH_LIMIT,
): string[] {
  const met = assessment
    .filter((a) => a.status === "met")
    .map((a) => `Demonstrated: ${a.text}`);

  // Genuine strengths stand alone. Partial rows already appear under concerns
  // as "worth confirming" — repeating them here made both columns read as the
  // same list for every mid-scoring candidate. They pad this list only when
  // NOTHING fully cleared the bar, preserving the original guarantee that an
  // evidenced candidate never reads "Strengths: none surfaced".
  if (met.length > 0) return met.slice(0, limit);

  const partial = assessment
    .filter((a) => a.status === "partial" && hasEvidence(a))
    .map((a) => `Evidence found, pending confirmation: ${a.text}`);

  return partial.slice(0, limit);
}
