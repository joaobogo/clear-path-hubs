/**
 * ScoringIdentity — the single canonical tuple that binds a score to the
 * exact candidate, position, application, rubric version, and run.
 *
 * Every scoring-adjacent server function returning candidate data must
 * return this shape (or embed it) so downstream UI cannot reconstruct
 * identity from partial keys and never mixes scores across positions.
 *
 * Rule: `candidate_id` alone is never enough. A candidate can have
 * completely different scores for different positions and the two must
 * never bleed.
 */

export type ScoringIdentity = {
  candidate_profile_id: string;
  position_id: string;
  application_id: string;
  rubric_version_id: string;
  score_run_id: string;
  /**
   * The score_run that is currently authorized for client visibility.
   * Equal to score_run_id when a candidate is published. Distinct from
   * score_run_id during review, correction, or supersession.
   */
  published_score_run_id: string | null;
  organization_id: string;
};

/**
 * Guard: refuses to return anything when required identity fields are
 * missing. Server functions that touch scoring should call this on the
 * row they read from `client_visible_candidates` or `candidate_matches`
 * before returning it to a client.
 */
export function assertScoringIdentity<T extends Partial<ScoringIdentity>>(
  row: T,
): asserts row is T & ScoringIdentity {
  const required: (keyof ScoringIdentity)[] = [
    "candidate_profile_id",
    "position_id",
    "application_id",
    "rubric_version_id",
    "score_run_id",
    "organization_id",
  ];
  for (const key of required) {
    if (!row[key]) {
      throw new Error(`scoring_identity_incomplete: missing ${String(key)}`);
    }
  }
}
