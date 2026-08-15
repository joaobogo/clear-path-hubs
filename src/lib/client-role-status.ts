// Plain-English role status — ONE status per role, shared by every client surface.
//
// Clients never see internal lifecycle values ("under_review", "approved",
// "needs_clarification") or candidate stages ("offer", "hired") as the role
// status. Pipeline activity is used only to prevent a false closure narrative.
//
// Pure module: no server imports, safe on both sides.

export const CLIENT_ROLE_STATUSES = [
  "active",
  "under_review",
  "paused",
  "closed",
] as const;

export type ClientRoleStatusKey = (typeof CLIENT_ROLE_STATUSES)[number];

export const CLIENT_ROLE_STATUS_LABELS: Record<ClientRoleStatusKey, string> = {
  active: "Active",
  under_review: "Under review",
  paused: "Paused",
  closed: "Closed",
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
 * One lifecycle status per role. Candidate stages remain pipeline milestones,
 * never role statuses. A role can only be Closed when no actionable pipeline
 * remains; inconsistent closed data therefore stays visibly Active until the
 * outstanding offers/interviews/decisions are resolved.
 */
export function computeClientRoleStatus(input: ClientRoleStatusInput): ClientRoleStatus {
  const raw = String(input.status ?? "")
    .trim()
    .toLowerCase();

  const isPaused = PAUSED.has(raw);
  const isClosed = CLOSED.has(raw);
  const hasActivePipeline =
    n(input.offers) > 0 ||
    n(input.interviewing) > 0 ||
    n(input.shortlisted) > 0 ||
    n(input.delivered) > 0;

  if (isPaused) return status("paused");
  if (isClosed && !hasActivePipeline) return status("closed");
  if (hasActivePipeline || LIVE.has(raw) || isClosed) return status("active");
  if (SETTING_UP.has(raw)) return status("under_review");
  return status("under_review");
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
