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

/**
 * Concern lines the engine STORED before it learned to name the pair, e.g.
 * "Screening/CV contradiction (screening contradicts cv)." Approved runs keep
 * the text they were scored with, so a run approved under the old engine kept
 * showing the raw status under the client's "What holds it back" long after
 * the engine stopped writing it (audit #4, item 12).
 */
const STORED_ENUM_CONCERN =
  /^screening\/cv\s+(?:contradiction|conflict)\s*[:(]\s*[a-z_ ]*\s*\)?\.?$/i;

/**
 * Rewrite a stored concern line for display. Returns null when the line is a
 * bare status token with nothing a reader could act on — the caller drops it.
 */
export function displayConcern(
  concern: string,
  rows?: ContradictionRow[] | null,
): string | null {
  const text = concern.trim();
  if (!STORED_ENUM_CONCERN.test(text)) return text;
  // Same flag, said properly — using the rows if this run recorded any.
  return (
    contradictionSentence("screening_contradicts_cv", rows) ??
    "A screening answer and the CV disagree. Confirm which is current before deciding."
  );
}
