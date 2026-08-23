/**
 * Audit actions the client workspace is allowed to see.
 *
 * Single source of truth so the Recent activity feed on /client and any figure
 * counted from the same events (for example the weekly "Decisions made" tile)
 * cannot disagree about what happened.
 */

/** Client-facing decision events — one row per recorded decision. */
export const CLIENT_DECISION_ACTIONS = [
  "client.shortlist",
  "client.request_interview",
  "client.offer",
  "client.hire",
  "client.not_moving_forward",
  "client.submit_feedback",
] as const;

/** Everything the Recent activity feed renders, decisions included. */
export const CLIENT_RELEVANT_ACTIONS = [
  "candidate_match.stage_changed",
  ...CLIENT_DECISION_ACTIONS,
  "position.approved",
  "position.activated",
  "position.paused",
] as const;
