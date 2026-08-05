/**
 * Interview logistics exceptions — shared types and pure classification.
 *
 * An interview is an exception when one of three record-derived conditions
 * holds:
 *   1. unconfirmed within 24h of its slot (status scheduled, no candidate
 *      confirmation),
 *   2. completed more than 24h ago with no submitted scorecard,
 *   3. two or more reschedules while still open.
 *
 * Nothing here infers state: every field comes from interviews,
 * interview_status_history or interview_scorecards.
 */

export const CONFIRM_WINDOW_MS = 24 * 3_600_000;
export const SCORECARD_GRACE_MS = 24 * 3_600_000;
export const RESCHEDULE_THRESHOLD = 2;
/** One nudge per interview per 24 hours. */
export const NUDGE_COOLDOWN_MS = 24 * 3_600_000;

export const CONFIRM_NUDGE_ACTION = "interview.confirmation_nudged";
export const SCORECARD_CHASE_ACTION = "interview.scorecard_chased";
export const INTERVIEW_ENTITY = "interview";

export type InterviewExceptionKind = "unconfirmed" | "missing_scorecard" | "reschedules";

export const EXCEPTION_LABEL: Record<InterviewExceptionKind, string> = {
  unconfirmed: "Unconfirmed slot",
  missing_scorecard: "Scorecard missing",
  reschedules: "Repeated reschedules",
};

export type InterviewExceptionRow = {
  interview_id: string;
  kinds: InterviewExceptionKind[];
  organization_id: string;
  organization_name: string;
  position_id: string;
  position_title: string;
  candidate_match_id: string | null;
  candidate_name: string;
  interviewer: string | null;
  interview_type: string | null;
  status: string;
  scheduled_at: string | null;
  timezone: string | null;
  completed_at: string | null;
  confirmation_state: "confirmed" | "declined" | "awaiting" | "not_applicable";
  reschedule_count: number;
  hours_to_slot: number | null;
  hours_since_completed: number | null;
  last_confirmation_nudge_at: string | null;
  last_scorecard_chase_at: string | null;
  nudge_allowed: boolean;
  chase_allowed: boolean;
};

export type InterviewExceptions = {
  rows: InterviewExceptionRow[];
  /** Cancellations in the last 7 days, for context. */
  cancellations_7d: number;
  generated_at: string;
};

export function confirmationState(
  response: unknown,
): InterviewExceptionRow["confirmation_state"] {
  const v = typeof response === "string" ? response.toLowerCase() : "";
  if (["confirmed", "accepted", "yes", "approved"].includes(v)) return "confirmed";
  if (["declined", "rejected", "no"].includes(v)) return "declined";
  return "awaiting";
}

export function hoursBetween(fromIso: string, toMs: number): number {
  return Math.round(((toMs - new Date(fromIso).getTime()) / 3_600_000) * 10) / 10;
}

/** Outcomes staff can record without touching a calendar. */
export const OUTCOMES = [
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "Candidate no-show" },
  { value: "cancelled", label: "Cancelled" },
  { value: "needs_rescheduling", label: "Needs rescheduling" },
] as const;

export type InterviewOutcome = (typeof OUTCOMES)[number]["value"];
