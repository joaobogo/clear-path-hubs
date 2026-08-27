/**
 * Which pipeline stages mean a candidate is still in play for a role.
 *
 * A candidate who is actively in play for a role cannot also be shown as
 * passed over for that role, so the talent pool ("Better fit selected")
 * excludes any memory whose source role still has a live match.
 */
export const ACTIVE_MATCH_STAGES = [
  "new",
  "reviewing",
  "delivered",
  "shortlisted",
  "interview_process",
  "offer",
  "hired",
] as const;

export type ActiveMatchStage = (typeof ACTIVE_MATCH_STAGES)[number];

export function isActiveMatchStage(stage: string | null | undefined): boolean {
  return !!stage && (ACTIVE_MATCH_STAGES as readonly string[]).includes(stage);
}

/** Key for a candidate-in-a-role pair. */
export function pairKey(profileId: string, positionId: string | null): string {
  return `${profileId}::${positionId ?? ""}`;
}

/**
 * Reasons that mean "passed over for this role".
 *
 * Only these are contradicted by the candidate still being live on that role.
 * The rest — timing, pay, level, location — describe the candidate, not the
 * outcome of the role, and stay visible whatever the pipeline says.
 */
export const PASSED_OVER_REASONS = ["better_fit_selected", "role_filled"] as const;

function isPassedOverReason(reason: string | null | undefined): boolean {
  return !!reason && (PASSED_OVER_REASONS as readonly string[]).includes(reason);
}

/**
 * Drops memories whose candidate is still in an active stage for the very role
 * they are recorded as passed over for.
 *
 * Scoped to the passed-over reasons on purpose. This used to drop EVERY memory
 * with a live match, which meant a client who added a candidate to their talent
 * pool for any reason — while that candidate was still `delivered` or
 * `shortlisted`, which is exactly when they are looking at them — wrote the
 * record and then watched the pool stay empty. The write succeeded; the read
 * hid it. Nothing told them why.
 */
export function excludeStillInPlay<
  T extends {
    candidate_profile_id: string;
    source_position_id: string | null;
    reason_category?: string | null;
  },
>(memories: T[], activePairs: Set<string>): T[] {
  return memories.filter((m) => {
    if (!isPassedOverReason(m.reason_category)) return true;
    return !activePairs.has(pairKey(m.candidate_profile_id, m.source_position_id));
  });
}
