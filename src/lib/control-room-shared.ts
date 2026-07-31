/**
 * Plain-language mapping for the live workspace ticker and the system status
 * strip. Client-safe: no server imports, no database access.
 */

export type LiveEventKind =
  | "candidate"
  | "stage"
  | "reply"
  | "interview"
  | "offer"
  | "role"
  | "other";

type Rule = { kind: LiveEventKind; sentence: string };

const EVENT_RULES: Record<string, Rule> = {
  application_received: { kind: "candidate", sentence: "New candidate applied" },
  candidate_published: { kind: "candidate", sentence: "New candidate delivered to you" },
  candidate_processing_completed: { kind: "candidate", sentence: "A CV finished processing" },
  screening_completed: { kind: "candidate", sentence: "Screening finished" },
  screening_needs_review: { kind: "candidate", sentence: "Screening needs a human look" },
  cv_parsed: { kind: "candidate", sentence: "A CV was read" },
  cv_parse_failed: { kind: "candidate", sentence: "A CV could not be read" },
  candidate_stage_changed: { kind: "stage", sentence: "A candidate moved stage" },
  client_shortlisted: { kind: "stage", sentence: "A candidate was shortlisted" },
  client_hold: { kind: "stage", sentence: "A candidate was put on hold" },
  client_declined: { kind: "stage", sentence: "A candidate was declined" },
  message_sent: { kind: "reply", sentence: "New message in a conversation" },
  interview_requested: { kind: "interview", sentence: "Interview requested" },
  interview_scheduled: { kind: "interview", sentence: "Interview booked" },
  interview_rescheduled: { kind: "interview", sentence: "Interview moved" },
  interview_cancelled: { kind: "interview", sentence: "Interview cancelled" },
  interview_completed: { kind: "interview", sentence: "Interview completed" },
  candidate_hired: { kind: "offer", sentence: "A candidate was hired" },
  position_filled: { kind: "offer", sentence: "A role was filled" },
  position_activated: { kind: "role", sentence: "A role went live" },
  position_paused: { kind: "role", sentence: "A role was paused" },
  position_closed: { kind: "role", sentence: "A role was closed" },
  position_reopened: { kind: "role", sentence: "A role reopened" },
  position_approved: { kind: "role", sentence: "A role was approved" },
  position_updated: { kind: "role", sentence: "A role was updated" },
  intake_submitted: { kind: "role", sentence: "A new role was submitted" },
  contact_released: { kind: "candidate", sentence: "Contact details released" },
  client_feedback_submitted: { kind: "stage", sentence: "Interview feedback added" },
};

/** Events that are noise on a live ticker. Precise beats complete. */
const MUTED = new Set([
  "client_viewed_candidate",
  "document_added",
  "member_invited",
  "member_removed",
  "contact_revoked",
  "contact_release_requested",
  "clarification_requested",
  "client_information_requested",
]);

export function isTickerEvent(eventType: string): boolean {
  return !MUTED.has(eventType) && !!EVENT_RULES[eventType];
}

export function describeEvent(eventType: string): Rule {
  return EVENT_RULES[eventType] ?? { kind: "other", sentence: "Something changed" };
}

/** Short "3 min ago" style stamp for small live rows. */
export function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export const JOB_TYPE_LABELS: Record<string, string> = {
  cv_extract: "Reading CVs",
  cv_hydration: "Reading CVs",
  scoring: "Scoring candidates",
  evidence_extract: "Pulling evidence from CVs",
  outreach_send: "Sending outreach",
  outreach_sequence: "Running outreach sequences",
  sourcing_scan: "Finding candidates",
  longlist_build: "Building longlists",
  scheduling_offer: "Offering interview times",
  interview_reminder: "Interview reminders",
  market_refresh: "Refreshing market data",
  role_realism: "Checking role realism",
  pipeline_scan: "Watching the pipeline",
  sla_check: "Checking service commitments",
  email_send: "Sending email",
  digest_weekly: "Weekly digest",
};

export function jobLabel(jobType: string): string {
  return JOB_TYPE_LABELS[jobType] ?? jobType.replace(/_/g, " ");
}

export const INTEGRATION_STATE_COPY: Record<
  string,
  { label: string; tone: "ok" | "warn" | "bad" | "idle" }
> = {
  healthy: { label: "Syncing normally", tone: "ok" },
  degraded: { label: "Syncing slowly", tone: "warn" },
  failing: { label: "Not syncing", tone: "bad" },
  not_connected: { label: "Not connected", tone: "idle" },
};
