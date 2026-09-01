/**
 * An ACTION REQUIRED item whose condition no longer holds must leave the feed.
 *
 * A notification is a snapshot of a moment. The record it describes keeps
 * moving, and nothing was watching: Rui Almeida's interview was reported to
 * staff as "Interview slot passed with no outcome — nobody marked it complete
 * or cancelled" while the client-facing row for the same person read "Interview
 * cancelled" and Operations counted it among 3 cancelled (7d). One interview,
 * described four ways across the product, one of them a task asking an operator
 * to chase something already resolved (audit 1 Sep, F40).
 *
 * `listMyNotifications` already reconciled one case — an approval_needed on a
 * candidate_match with a recorded client decision. That was the right mechanism
 * pointed at one condition. This module is the same mechanism written so the
 * conditions are a list, and so each can be tested without a database.
 *
 * Browser-safe: pure functions only.
 */

export type OpenActionable = {
  id: string;
  entity_type: string | null;
  entity_id: string | null;
  title?: string | null;
};

/**
 * The staff task the no-show sweep raises, worded once.
 *
 * interview-reminders.server.ts writes this title and this module matches on
 * it, so the two cannot drift into a reconciler that silently stops matching.
 * Asserted directly by the guard test, which reads both files.
 */
export const INTERVIEW_NO_OUTCOME_TITLE = "Interview slot passed with no outcome";

/**
 * Ids to mark resolved: those whose subject appears in `settled`.
 *
 * `settled` is the set of entity ids a caller has established are done — a
 * match with a client decision, a match whose interview now has an outcome.
 * Entity type must match too, so a position id can never resolve a
 * candidate_match notification by colliding on a shared UUID.
 */
export function resolvedActionableIds(
  open: readonly OpenActionable[],
  entityType: string,
  settled: ReadonlySet<string>,
  /**
   * Restricts the sweep to items with this exact title.
   *
   * Omit it and every open actionable on a settled subject is resolved, which
   * is right for "the client decided" — that decision is what every
   * approval_needed on that match was waiting for. It is wrong for "the
   * interview has an outcome", which answers ONE task and says nothing about a
   * shortlist approval sitting on the same match. A condition that resolves
   * more than it answers is a worse failure than the stale row it replaces:
   * the operator never sees the item at all.
   */
  title?: string,
): string[] {
  return open
    .filter((n) => n.entity_type === entityType && n.entity_id && settled.has(n.entity_id))
    .filter((n) => title === undefined || n.title === title)
    .map((n) => n.id);
}

/** Entity ids of the open items worth checking, so a caller queries only those. */
export function subjectIds(
  open: readonly OpenActionable[],
  entityType: string,
): string[] {
  const out = new Set<string>();
  for (const n of open) {
    if (n.entity_type === entityType && n.entity_id) out.add(n.entity_id);
  }
  return [...out];
}

/**
 * Interview statuses that answer "what happened?".
 *
 * The no-show sweep raises its notification precisely because nobody had
 * answered that question. Any of these answers it, including a cancellation
 * recorded after the sweep ran — which is the case that produced the finding.
 *
 * `scheduling` and `requested` are deliberately absent: an interview being
 * rebooked has still not accounted for the slot that passed.
 */
export const INTERVIEW_OUTCOME_STATUSES: readonly string[] = [
  "completed",
  "cancelled",
  "no_show",
];

export function interviewHasOutcome(
  row: { status?: string | null; completed_at?: string | null; cancelled_at?: string | null },
): boolean {
  if (row.completed_at || row.cancelled_at) return true;
  return INTERVIEW_OUTCOME_STATUSES.includes(String(row.status ?? ""));
}
