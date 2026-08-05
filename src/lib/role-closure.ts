// Role closure — pure domain rules, no I/O.
//
// A role either stays open or is closed with a recorded reason. There is no
// third state: closing by message or leaving a role open forever corrupts every
// count the client sees. "On hold" is the one reason that pauses instead of
// archiving, and it must carry an expected restart date so the role does not
// become a permanent unknown.

export const CLOSE_REASONS = [
  "hired_through_taasflow",
  "hired_elsewhere",
  "on_hold",
  "cancelled",
  "budget_withdrawn",
] as const;

export type CloseRoleReason = (typeof CLOSE_REASONS)[number];

export const CLOSE_REASON_LABEL: Record<CloseRoleReason, string> = {
  hired_through_taasflow: "Hired through TaaSFlow",
  hired_elsewhere: "Hired elsewhere",
  on_hold: "On hold",
  cancelled: "Cancelled",
  budget_withdrawn: "Budget withdrawn",
};

export const CLOSE_REASON_HELP: Record<CloseRoleReason, string> = {
  hired_through_taasflow: "The role was filled by a candidate we presented.",
  hired_elsewhere: "The role was filled outside this search.",
  on_hold: "Paused for now — we keep the work and restart on your date.",
  cancelled: "The role is no longer being hired for.",
  budget_withdrawn: "Funding for the role was withdrawn.",
};

export function isCloseReason(value: unknown): value is CloseRoleReason {
  return typeof value === "string" && (CLOSE_REASONS as readonly string[]).includes(value);
}

/** "On hold" keeps the role in the Paused list; every other reason archives it. */
export function pausesInsteadOfArchiving(reason: CloseRoleReason): boolean {
  return reason === "on_hold";
}

/** Position status a role lands on for the given reason. */
export function statusForReason(reason: CloseRoleReason): "paused" | "filled" | "closed" {
  if (reason === "on_hold") return "paused";
  if (reason === "hired_through_taasflow") return "filled";
  return "closed";
}

export const CLOSE_NOTE_MAX = 1000;

export type CloseRoleValidation = {
  ok: boolean;
  /** Field-level messages, keyed by the field the user must fix. */
  errors: { reason?: string; note?: string; restartDate?: string };
};

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function todayISO(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Validates a close request. Reason is always required. "On hold" additionally
 * requires an expected restart date that is a real, non-past date.
 */
export function validateCloseRole(
  input: { reason?: string | null; note?: string | null; restartDate?: string | null },
  now: Date = new Date(),
): CloseRoleValidation {
  const errors: CloseRoleValidation["errors"] = {};

  if (!isCloseReason(input.reason)) {
    errors.reason = "Choose a reason for closing this role.";
  }

  const note = (input.note ?? "").trim();
  if (note.length > CLOSE_NOTE_MAX) {
    errors.note = `Keep the note under ${CLOSE_NOTE_MAX} characters.`;
  }

  if (isCloseReason(input.reason) && input.reason === "on_hold") {
    const date = (input.restartDate ?? "").trim();
    if (!date) {
      errors.restartDate = "Add the date you expect to restart this role.";
    } else if (!isRealDate(date)) {
      errors.restartDate = "Enter a real date.";
    } else if (date < todayISO(now)) {
      errors.restartDate = "The restart date cannot be in the past.";
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/** Statuses that count as active work for a client. */
export const ACTIVE_ROLE_STATUSES = ["active", "approved"] as const;

/** Closed roles stay readable here rather than being deleted. */
export const ARCHIVED_ROLE_STATUSES = ["filled", "closed", "archived"] as const;

export function isArchivedStatus(status: string | null | undefined): boolean {
  return (ARCHIVED_ROLE_STATUSES as readonly string[]).includes(String(status ?? ""));
}

export function isClosedOrPaused(status: string | null | undefined): boolean {
  return isArchivedStatus(status) || String(status ?? "") === "paused";
}

export type RoleClosureSummary = {
  reason: CloseRoleReason;
  reasonLabel: string;
  note: string | null;
  closedAt: string | null;
  closedByName: string | null;
  restartExpectedOn: string | null;
  /** True when the role sits in the Paused list rather than the archive. */
  paused: boolean;
};
