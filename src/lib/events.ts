// Canonical event catalogue for TaaSFlow (Phase 10).
// This module is BROWSER-SAFE: it only exports constants and pure copy maps.

export const EVENT_TYPES = [
  "intake_submitted",
  "clarification_requested",
  "position_approved",
  "position_activated",
  "application_received",
  "candidate_processing_completed",
  "candidate_ready_for_admin_review",
  "candidate_published",
  "client_shortlisted",
  "interview_requested",
  "interview_scheduled",
  "interview_rescheduled",
  "client_feedback_submitted",
  "candidate_hired",
  "position_paused",
  "position_filled",
  "position_closed",
  "message_sent",
  "position_updated",
  "position_reopened",
  "cv_parsed",
  "cv_parse_failed",
  "screening_completed",
  "screening_needs_review",
  "contact_released",
  "contact_revoked",
  "client_viewed_candidate",
  "interview_completed",
  "interview_cancelled",
  "candidate_stage_changed",
  "document_added",
  "member_invited",
  "member_removed",
  "client_hold",
  "client_declined",
  "client_information_requested",
  "contact_release_requested",
  // System / operational events (see notification-tiers.ts for urgency rules).
  "payment_failed",
  "integration_failed",
  "security_alert",
  "agent_run_blocked",
  "role_information_missing",
  "approval_needed",
  "shortlist_ready",
  "scoring_completed",
  "sync_completed",
  "scheduled_run_completed",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type Audience = "admin" | "client" | "candidate";

export type CopyEntry = { title: string; body?: string };

// Language rules:
// - Admin copy: operational, precise.
// - Client copy: business outcomes; never internal states or raw scores.
// - Candidate copy: encouraging; never reveals scores, admin steps, or failures.

export const ADMIN_COPY: Partial<Record<EventType, CopyEntry>> = {
  intake_submitted: { title: "New client intake", body: "A new intake is ready for review." },
  // Without admin copy the staff fanout produced zero rows: copyFor('admin', …)
  // gated recipient resolution, so anonymous applications never reached the bell.
  application_received: { title: "New application received", body: "A new application is waiting in the candidate queue." },
  candidate_ready_for_admin_review: { title: "Candidate ready for review", body: "A candidate has completed processing." },
  candidate_processing_completed: { title: "Processing finished", body: "Candidate processing pipeline finished." },
  client_shortlisted: { title: "Client shortlisted a candidate", body: "A client just moved a candidate to shortlist." },
  client_feedback_submitted: { title: "Client feedback received" },
  interview_requested: { title: "Your interview request is waiting on a time" },
  message_sent: { title: "New client message" },
  cv_parse_failed: { title: "CV parsing failed", body: "A CV could not be parsed and needs attention." },
  screening_needs_review: { title: "Screening needs review", body: "A screening result requires a human decision." },
  client_hold: { title: "Client placed a candidate on hold" },
  client_declined: { title: "Client declined a candidate", body: "A client decided not to move forward." },
  client_information_requested: { title: "Client requested more information" },
  contact_release_requested: { title: "Client requested contact details", body: "Review and release contact details if approved." },
  payment_failed: { title: "Payment failed", body: "A workspace payment did not go through." },
  integration_failed: { title: "Integration failing", body: "A connection stopped responding and needs attention." },
  security_alert: { title: "Security alert", body: "Unusual account access was recorded." },
  agent_run_blocked: { title: "Agent run blocked", body: "An automated run stopped and will not resume on its own." },
  role_information_missing: { title: "Role information missing", body: "Required details are missing before sourcing can start." },
  approval_needed: { title: "Approval needed", body: "An item is waiting on a decision." },
  shortlist_ready: { title: "Shortlist ready", body: "A shortlist is ready to send to the client." },
  scoring_completed: { title: "Evidence review finished" },
  sync_completed: { title: "Synchronisation finished" },
  scheduled_run_completed: { title: "Scheduled run finished" },
};

export const CLIENT_COPY: Partial<Record<EventType, CopyEntry>> = {
  clarification_requested: { title: "We need a quick clarification", body: "Please review the open question on your role." },
  position_approved: { title: "Your role is approved", body: "We are preparing your position for launch." },
  position_activated: { title: "Your role is live", body: "Candidates can now apply." },
  position_reopened: { title: "Your role is open again", body: "We resumed sourcing for this position." },
  candidate_published: { title: "New candidate delivered", body: "A vetted candidate is available in your workspace." },
  interview_scheduled: { title: "Interview scheduled" },
  interview_rescheduled: { title: "Interview being rescheduled", body: "New times have gone out to the candidate." },
  interview_completed: { title: "Interview completed" },
  interview_cancelled: { title: "Interview cancelled" },
  contact_released: { title: "Contact details available", body: "You can now reach this candidate directly." },
  message_sent: { title: "New message from TaaSFlow" },
  position_closed: { title: "Position closed" },
  member_invited: { title: "Team member invited" },
  member_removed: { title: "Team member removed" },
  payment_failed: { title: "Payment did not go through", body: "Update your payment details to keep roles publishing." },
  integration_failed: { title: "A connection needs attention", body: "Updates from this system have stopped arriving." },
  security_alert: { title: "Please review account access", body: "We recorded sign-in activity worth checking." },
  approval_needed: { title: "Something is waiting on you", body: "A decision is needed before work continues." },
  role_information_missing: { title: "Your role needs a few details", body: "Sourcing is paused until the role is complete." },
  agent_run_blocked: { title: "Automated work is paused", body: "We hit a blocker on this role and need a quick input." },
  shortlist_ready: { title: "Your shortlist is ready", body: "Compare the candidates side by side." },
  scoring_completed: { title: "Candidate evidence updated", body: "New findings may change how candidates compare." },
  sync_completed: { title: "Your workspace data is up to date" },
  scheduled_run_completed: { title: "Scheduled sourcing run finished" },
};

export const CANDIDATE_COPY: Partial<Record<EventType, CopyEntry>> = {
  application_received: { title: "Application received", body: "Thanks — we have your application and will be in touch." },
  clarification_requested: { title: "We need a bit more information", body: "Please check your application for an open question." },
  candidate_published: { title: "You are under consideration", body: "You have advanced to the next step." },
  client_shortlisted: { title: "You have been shortlisted", body: "The client has shortlisted you for their role." },
  interview_requested: { title: "Interview request", body: "The client would like to interview you." },
  interview_scheduled: { title: "Your interview is scheduled" },
  interview_rescheduled: { title: "New interview times", body: "Please choose a new time that works for you." },
  interview_completed: { title: "Interview completed", body: "Thanks for your time — we will follow up." },
  interview_cancelled: { title: "Interview cancelled", body: "We will be in touch with next steps." },
  candidate_hired: { title: "Congratulations — offer stage", body: "The client has moved forward with an offer." },
  message_sent: { title: "New message" },
};

export function copyFor(audience: Audience, event: EventType): CopyEntry | null {
  const map = audience === "admin" ? ADMIN_COPY : audience === "client" ? CLIENT_COPY : CANDIDATE_COPY;
  return map[event] ?? null;
}

// ─── Activity feed (derived view over the same source events) ───────────────
// Notifications are "you must know now". Activity is "what happened here".
// Both derive from a single persisted row in notification_events.

export const ACTIVITY_LABELS: Record<EventType, string> = {
  intake_submitted: "Client intake submitted",
  clarification_requested: "Clarification requested",
  position_approved: "Job approved",
  position_activated: "Job activated",
  position_updated: "Job updated",
  position_paused: "Job paused",
  position_reopened: "Job reopened",
  position_filled: "Job filled",
  position_closed: "Job closed",
  application_received: "Application submitted",
  cv_parsed: "CV parsed",
  cv_parse_failed: "CV parsing failed",
  candidate_processing_completed: "Processing completed",
  screening_completed: "Screening completed",
  screening_needs_review: "Screening needs review",
  candidate_ready_for_admin_review: "Ready for review",
  candidate_published: "Approved for client view",
  contact_released: "Contact details released",
  contact_revoked: "Contact details revoked",
  client_viewed_candidate: "Client viewed candidate",
  client_shortlisted: "Candidate shortlisted",
  client_feedback_submitted: "Feedback added",
  candidate_stage_changed: "Status changed",
  interview_requested: "Interview requested",
  interview_scheduled: "Interview scheduled",
  interview_rescheduled: "Interview rescheduled",
  interview_completed: "Interview completed",
  interview_cancelled: "Interview cancelled",
  candidate_hired: "Placement confirmed",
  message_sent: "Message sent",
  payment_failed: "Payment failed",
  integration_failed: "Integration failed",
  security_alert: "Security alert",
  agent_run_blocked: "Agent run blocked",
  role_information_missing: "Role information missing",
  approval_needed: "Approval needed",
  shortlist_ready: "Shortlist ready",
  scoring_completed: "Evidence review completed",
  sync_completed: "Synchronisation completed",
  scheduled_run_completed: "Scheduled run completed",
  document_added: "Document added",
  member_invited: "Team member invited",
  member_removed: "Team member removed",
  client_hold: "Candidate placed on hold",
  client_declined: "Candidate declined for this role",
  client_information_requested: "More information requested",
  contact_release_requested: "Contact details requested",
};

/**
 * Which audiences may see an event *in the activity feed*.
 * Row-level security already limits the rows a user can read; this is the
 * second, editorial gate that keeps internal operational noise out of client
 * and candidate views. Nothing outside these sets is ever rendered.
 */
const ADMIN_ACTIVITY: readonly EventType[] = EVENT_TYPES;

const CLIENT_ACTIVITY: readonly EventType[] = [
  "intake_submitted",
  "clarification_requested",
  "position_approved",
  "position_activated",
  "position_updated",
  "position_paused",
  "position_reopened",
  "position_filled",
  "position_closed",
  "candidate_published",
  "contact_released",
  "contact_revoked",
  "client_viewed_candidate",
  "client_shortlisted",
  "client_feedback_submitted",
  "candidate_stage_changed",
  "interview_requested",
  "interview_scheduled",
  "interview_rescheduled",
  "interview_completed",
  "interview_cancelled",
  "candidate_hired",
  "message_sent",
  "document_added",
  "member_invited",
  "member_removed",
  "client_hold",
  "client_declined",
  "client_information_requested",
  "contact_release_requested",
];

const CANDIDATE_ACTIVITY: readonly EventType[] = [
  "application_received",
  "clarification_requested",
  "candidate_published",
  "client_shortlisted",
  "interview_requested",
  "interview_scheduled",
  "interview_rescheduled",
  "interview_completed",
  "interview_cancelled",
  "candidate_hired",
  "message_sent",
  "document_added",
];

export function isVisibleActivity(audience: Audience, event: EventType): boolean {
  const set =
    audience === "admin" ? ADMIN_ACTIVITY : audience === "client" ? CLIENT_ACTIVITY : CANDIDATE_ACTIVITY;
  return set.includes(event);
}

// ─── Canonical state machines (mirrored by database triggers) ───────────────
// Source of truth for UI affordances. The server rejects anything not listed
// here via triggers: tg_positions_lifecycle_guard, tg_candidate_matches_*,
// tg_interviews_lifecycle, tg_hire_records_lifecycle.

export const JOB_STATES = {
  draft: ["submitted", "archived"],
  submitted: ["under_review", "needs_clarification", "approved", "archived"],
  under_review: ["approved", "needs_clarification", "archived"],
  needs_clarification: ["submitted", "under_review", "approved", "archived"],
  approved: ["active", "archived"],
  active: ["paused", "filled", "closed", "archived"],
  paused: ["active", "closed", "archived"],
  filled: ["active", "closed", "archived"],
  closed: ["active", "archived"],
  archived: [],
} as const;

export const APPLICATION_STATES = {
  submitted: ["processing", "withdrawn", "rejected", "archived"],
  processing: ["ready_for_review", "rejected", "archived"],
  ready_for_review: ["withdrawn", "rejected", "archived"],
  withdrawn: [],
  rejected: ["archived"],
  archived: [],
} as const;

export const SCREENING_STATES = {
  ingestion: ["evidence_extraction", "failed"],
  evidence_extraction: ["provisional_scoring", "failed", "returned_for_correction"],
  provisional_scoring: ["human_review", "failed", "returned_for_correction"],
  human_review: ["approved", "returned_for_correction", "failed"],
  returned_for_correction: ["evidence_extraction", "provisional_scoring", "human_review", "failed"],
  approved: ["published_to_client", "returned_for_correction", "superseded"],
  published_to_client: ["superseded", "returned_for_correction"],
  superseded: ["returned_for_correction"],
  failed: ["ingestion", "returned_for_correction"],
} as const;

export const PIPELINE_STAGE_STATES = {
  new: ["reviewing", "delivered", "not_moving_forward", "archived"],
  reviewing: ["delivered", "not_moving_forward", "archived"],
  delivered: ["shortlisted", "interview_process", "not_moving_forward", "archived", "reviewing"],
  shortlisted: ["interview_process", "offer", "not_moving_forward", "archived", "delivered"],
  interview_process: ["offer", "not_moving_forward", "archived", "shortlisted"],
  offer: ["hired", "not_moving_forward", "archived", "interview_process"],
  hired: ["archived"],
  not_moving_forward: ["delivered", "shortlisted", "archived"],
  archived: ["delivered"],
} as const;

export const INTERVIEW_STATES = {
  requested: ["scheduling", "scheduled", "cancelled"],
  scheduling: ["scheduled", "cancelled"],
  scheduled: ["completed", "cancelled", "scheduling"],
  completed: [],
  cancelled: ["requested", "scheduling"],
} as const;

export const PLACEMENT_STATES = {
  offer_drafted: ["offer_sent", "closed_lost"],
  offer_sent: ["offer_negotiating", "offer_accepted", "offer_declined", "closed_lost"],
  offer_negotiating: ["offer_sent", "offer_accepted", "offer_declined", "closed_lost"],
  offer_accepted: ["hire_confirmed", "closed_lost"],
  offer_declined: ["offer_drafted", "closed_lost"],
  hire_confirmed: ["closed_lost"],
  closed_lost: ["offer_drafted"],
} as const;


/** Client approval and contact release are two separate, ordered permissions. */
export const CLIENT_ACCESS_STATES = {
  hidden: ["approved"],
  approved: ["hidden", "contact_released"],
  contact_released: ["approved", "hidden"],
} as const;

// Idempotency keys are deterministic. Same real-world event => same key => single row.
export function eventKey(event: EventType, scope: string): string {
  return `${event}:${scope}`;
}

