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
 * Drops memories whose candidate is still in an active stage for the very role
 * they are recorded as passed over for.
 */
export function excludeStillInPlay<
  T extends { candidate_profile_id: string; source_position_id: string | null },
>(memories: T[], activePairs: Set<string>): T[] {
  return memories.filter(
    (m) => !activePairs.has(pairKey(m.candidate_profile_id, m.source_position_id)),
  );
}
