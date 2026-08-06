/**
 * Single source of truth for internal lead-notification routing.
 *
 * Recipients are configuration, never hardcoded at a call site. Every value can
 * be overridden per environment without touching code:
 *
 *   LEAD_ALERT_RECIPIENTS                 default internal recipients
 *   LEAD_ALERT_RECIPIENTS_<TYPE>          per lead-type override (see LeadType)
 *   TEAMS_TEAM_ID / TEAMS_CHANNEL_ID      Teams destination (teams-notify.server)
 *
 * Pure and browser-safe: env reads happen in functions, not at module scope.
 */

export const LEAD_TYPES = [
  "employer_intake",
  "partial_intake",
  "express_intake",
  "discovery_call",
  "marketing_inquiry",
  "contact_message",
  "candidate_application",
] as const;

export type LeadType = (typeof LEAD_TYPES)[number];

export type LeadPriority = "urgent" | "high" | "standard";

/** Human labels used in Teams cards, emails and the admin ledger. */
export const LEAD_TYPE_LABEL: Record<LeadType, string> = {
  employer_intake: "Employer intake",
  partial_intake: "Intake started (incomplete)",
  express_intake: "Express onboarding",
  discovery_call: "Discovery call booking",
  marketing_inquiry: "Marketing inquiry",
  contact_message: "Contact form message",
  candidate_application: "Candidate application",
};

/** Baseline urgency per lead type. Individual events can raise this. */
export const LEAD_TYPE_PRIORITY: Record<LeadType, LeadPriority> = {
  employer_intake: "urgent",
  partial_intake: "high",
  express_intake: "urgent",
  discovery_call: "urgent",
  marketing_inquiry: "high",
  contact_message: "high",
  candidate_application: "standard",
};

/** Where staff should land to action the lead. */
export const LEAD_TYPE_DEFAULT_LINK: Record<LeadType, string> = {
  employer_intake: "/admin/intake",
  partial_intake: "/admin/intake",
  express_intake: "/admin/positions",
  discovery_call: "/admin/pending-leads",
  marketing_inquiry: "/admin/pending-leads",
  contact_message: "/admin/messages",
  candidate_application: "/admin/candidates",
};

/** Last-resort recipient when nothing is configured in the environment. */
export const FALLBACK_LEAD_RECIPIENT = "john.kasprzak@taasflow.com";

function parseList(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(/[,;\s]+/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v));
}

/**
 * Internal recipients for a lead type, most specific first. Server-only usage
 * (reads process.env); returns the fallback so a lead is never silently
 * un-notified because of a missing environment variable.
 */
export function leadAlertRecipients(leadType: LeadType): string[] {
  const specific = parseList(process.env[`LEAD_ALERT_RECIPIENTS_${leadType.toUpperCase()}`]);
  if (specific.length > 0) return Array.from(new Set(specific));
  const general = parseList(process.env["LEAD_ALERT_RECIPIENTS"]);
  if (general.length > 0) return Array.from(new Set(general));
  return [FALLBACK_LEAD_RECIPIENT];
}

/** Absolute app origin used in Teams cards and emails. */
export function appOrigin(): string {
  return (process.env["PUBLIC_APP_URL"] ?? "https://taasflow.com").replace(/\/+$/, "");
}
