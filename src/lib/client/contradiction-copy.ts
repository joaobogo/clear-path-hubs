/**
 * The ONE client-facing sentence for a screening/CV contradiction.
 *
 * Clients were shown the raw enum — "screening_contradicts_cv — flagged in
 * evidence review before this candidate was delivered to your workspace." —
 * with no way to know WHAT conflicted (audit #3, finding 2). A contradiction
 * either names its pair in plain words or it says nothing at all.
 */

export type ContradictionRow = {
  question?: string | null;
  requirement?: string | null;
};

export function contradictionSentence(
  status: string | null | undefined,
  rows?: ContradictionRow[] | null,
): string | null {
  if (!status || status === "none") return null;
  if (status === "disqualifying_answer") {
    return "A screening answer did not meet one of this role's dealbreakers, so the score is capped.";
  }
  const pairs = (rows ?? []).filter((r) => r?.question && r?.requirement);
  if (pairs.length === 0) {
    // A flag with nothing to resolve is noise, not information — render nothing.
    return null;
  }
  const first = pairs[0]!;
  const more = pairs.length > 1 ? ` (and ${pairs.length - 1} more like it)` : "";
  return `The candidate answered "yes" to "${String(first.question).trim()}", but the CV does not back up "${String(first.requirement).trim()}"${more} — worth confirming in the interview.`;
}
