/**
 * What re-running enrichment is allowed to do to a match's processing state.
 *
 * Enrichment refreshes the evidence snapshot. It used to end by setting every
 * match to `ready_to_score`, which walked an already-scored candidate
 * backwards: a five-minute reassessment that returned an identical score, and
 * a screen that said "Assessing against the role" beside "Approve the score
 * for client release" while a reviewer was midway through (audit #4, L15).
 *
 * The rule lives here, apart from the pipeline runner's database plumbing, so
 * it can be stated and tested as the policy it is.
 */

/** States carrying a completed assessment someone may be reviewing. */
const COMPLETED_ASSESSMENT = new Set(["scored"]);

export type EnrichmentStateDecision =
  | { keepState: true; markScoreStale: true }
  | { keepState: false; nextState: "ready_to_score" };

/**
 * Decide what happens to `currentState` once enrichment has written fresh
 * evidence.
 *
 * `manual_review_required` is deliberately NOT treated as a completed
 * assessment: it is the state an admin retries *out of* after fixing the cause
 * (an inactive position, a brief with no structured requirements). Holding a
 * match there would strand it permanently.
 */
export function decideStateAfterEnrichment(
  currentState: string | null | undefined,
): EnrichmentStateDecision {
  if (COMPLETED_ASSESSMENT.has(String(currentState ?? ""))) {
    // The evidence did change, so the existing score is flagged stale rather
    // than discarded. The reviewer decides whether to rescore.
    return { keepState: true, markScoreStale: true };
  }
  return { keepState: false, nextState: "ready_to_score" };
}
