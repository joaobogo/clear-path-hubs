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
 * Shortlist ready > Sourcing > Setting up.
 *
 * A role is only "Hired" or "Closed" if it has no active pipeline items
 * (interviews, offers) that contradict the closure narrative.
 */
export function computeClientRoleStatus(input: ClientRoleStatusInput): ClientRoleStatus {
  const raw = String(input.status ?? "")
    .trim()
    .toLowerCase();

  const isPaused = PAUSED.has(raw);
  const isClosed = CLOSED.has(raw);
  const hasHires = n(input.hires) > 0;
  const hasOffers = n(input.offers) > 0;
  const hasInterviews = n(input.interviewing) > 0;
  const hasShortlist = n(input.shortlisted) > 0 || n(input.delivered) > 0;

  // 1. Paused always wins if explicitly set.
  if (isPaused) return status("paused");

  // 2. A role with active pipeline (Offer/Interview) is NOT Hired or Closed yet,
  // even if a hire was made, unless the status is explicitly set to a closed state.
  // But even then, we prefer to show the active milestone if we haven't archived it.
  if (hasOffers) return status("offer_out");
  if (hasInterviews) return status("interviewing");

  // 3. If no active high-intent pipeline, check for Hired status.
  if (hasHires) return status("hired");

  // 4. Closed status wins if no active pipeline and no hires (or explicitly closed).
  if (isClosed) return status("closed");

  // 5. Active search states.
  if (hasShortlist) return status("shortlist_ready");
  if (LIVE.has(raw)) return status("sourcing");
  if (SETTING_UP.has(raw)) return status("setting_up");

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
