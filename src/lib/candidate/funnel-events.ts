/**
 * Canonical candidate funnel events.
 *
 * These are product-analytics events only. They never carry a score, a rank,
 * an inferred personal characteristic, free text typed by the candidate, or
 * any keystroke/time-on-page telemetry. Each event answers one question about
 * where the product fails to explain itself.
 */

export const CANDIDATE_FUNNEL_EVENTS = {
  job_viewed: "A public job page was opened",
  apply_started: "The application flow was entered",
  apply_step_completed: "A step of the application was completed",
  apply_step_blocked: "A step could not be completed because of a validation issue",
  apply_draft_saved: "A local draft was written",
  apply_resumed: "A saved draft was restored",
  apply_abandoned: "The flow was left without submitting",
  cv_rejected: "A CV file was refused before upload (type or size)",
  apply_reviewed: "The review step was reached",
  apply_submitted: "An application was submitted",
  apply_duplicate_detected: "A returning applicant hit an existing application",
  confirmation_viewed: "The confirmation page was seen",
  tracker_viewed: "An application detail page was opened",
  status_explained_opened: "A candidate opened the explanation of their status",
  timeline_viewed: "The application timeline was expanded",
  profile_item_completed: "A profile gap item was resolved",
  cv_replaced: "A CV was replaced",
  employer_view_opened: "The 'what an employer sees' preview was opened",
  interview_slots_viewed: "Proposed interview times were seen",
  interview_responded: "A candidate accepted, declined or asked for another time",
  interview_change_requested: "A reschedule or cancellation was requested",
  notification_prefs_saved: "Notification preferences were changed",
  data_export_requested: "A copy of personal data was requested",
  accommodation_submitted: "An accommodation request was submitted",
  application_withdrawn: "A candidate withdrew",
  support_requested: "A support request was submitted",
} as const;

export type CandidateFunnelEvent = keyof typeof CANDIDATE_FUNNEL_EVENTS;

export const CANDIDATE_FUNNEL_EVENT_NAMES = Object.keys(
  CANDIDATE_FUNNEL_EVENTS,
) as CandidateFunnelEvent[];

export function isCandidateFunnelEvent(value: unknown): value is CandidateFunnelEvent {
  return typeof value === "string" && value in CANDIDATE_FUNNEL_EVENTS;
}

/** Non-identifying context allowed alongside an event. */
export type CandidateFunnelContext = {
  /** Public position id, when the event happens on a role surface. */
  position_id?: string;
  /** Application reference (6 chars), never an email or a name. */
  reference?: string;
  /** Step key of the apply flow, e.g. "cv" or "questions". */
  step?: string;
  /** Coarse device bucket, derived from viewport width only. */
  device?: "phone" | "tablet" | "desktop";
  /** Short machine reason, e.g. "wrong_type" or "too_large". */
  reason?: string;
  /** Support or accommodation category key, never the message body. */
  category?: string;
};

export function deviceBucket(width: number): NonNullable<CandidateFunnelContext["device"]> {
  if (width < 640) return "phone";
  if (width < 1024) return "tablet";
  return "desktop";
}
