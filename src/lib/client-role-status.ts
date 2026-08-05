// Plain-English role status — ONE status per role, shared by every client surface.
//
// Clients never see internal lifecycle values ("under_review", "approved",
// "needs_clarification"). They see where the role actually is, derived from the
// furthest meaningful candidate stage. Paused and Closed always win.
//
// Pure module: no server imports, safe on both sides.

export const CLIENT_ROLE_STATUSES = [
  "setting_up",
  "sourcing",
  "shortlist_ready",
  "interviewing",
  "offer_out",
  "hired",
  "paused",
  "closed",
  "in_progress",
] as const;

export type ClientRoleStatusKey = (typeof CLIENT_ROLE_STATUSES)[number];

export const CLIENT_ROLE_STATUS_LABELS: Record<ClientRoleStatusKey, string> = {
  setting_up: "Setting up",
  sourcing: "Sourcing",
  shortlist_ready: "Shortlist ready for you",
  interviewing: "Interviewing",
  offer_out: "Offer out",
  hired: "Hired",
  paused: "Paused",
  closed: "Closed",
  in_progress: "In progress",
};

/** Shown when the status could not be resolved — never defaults to Sourcing. */
export const CLIENT_ROLE_STATUS_UNAVAILABLE = "Status unavailable";

export type ClientRoleStatus = {
  key: ClientRoleStatusKey;
  label: string;
};

export type ClientRoleStatusInput = {
  /** Raw internal positions.status value. */
  status: string | null | undefined;
  /** Confirmed hires on this role. */
  hires?: number;
  /** Candidates at offer. */
  offers?: number;
  /** Candidates in an interview process. */
  interviewing?: number;
  /** Candidates the client shortlisted. */
  shortlisted?: number;
  /** Candidates delivered to the client (waiting on a first look). */
  delivered?: number;
};

const PAUSED = new Set(["paused", "on_hold"]);
const CLOSED = new Set(["closed", "archived", "filled", "cancelled"]);
const SETTING_UP = new Set(["draft", "submitted", "under_review", "needs_clarification"]);
const LIVE = new Set(["active", "approved", "open", "published"]);

const n = (v: number | undefined) => (typeof v === "number" && v > 0 ? v : 0);

/**
 * One status per role, derived from pipeline reality.
 * Order of precedence: Paused/Closed > Hired > Offer out > Interviewing >
 * Shortlist ready > Sourcing > Setting up. Unmapped internal values that show
 * no pipeline activity render "In progress", never the raw value.
 */
export function computeClientRoleStatus(input: ClientRoleStatusInput): ClientRoleStatus {
  const raw = String(input.status ?? "")
    .trim()
    .toLowerCase();

  if (PAUSED.has(raw)) return status("paused");
  if (CLOSED.has(raw) && !n(input.hires)) return status("closed");
  if (n(input.hires)) return status("hired");
  if (CLOSED.has(raw)) return status("closed");

  if (n(input.offers)) return status("offer_out");
  if (n(input.interviewing)) return status("interviewing");
  if (n(input.shortlisted) || n(input.delivered)) return status("shortlist_ready");

  if (SETTING_UP.has(raw)) return status("setting_up");
  if (LIVE.has(raw)) return status("sourcing");

  return status("in_progress");
}

function status(key: ClientRoleStatusKey): ClientRoleStatus {
  return { key, label: CLIENT_ROLE_STATUS_LABELS[key] };
}

/** Safe label for a payload that may be missing the derived status. */
export function clientRoleStatusLabel(
  value: ClientRoleStatus | null | undefined,
): string {
  return value?.label ?? CLIENT_ROLE_STATUS_UNAVAILABLE;
}
