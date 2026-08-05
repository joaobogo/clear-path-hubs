/**
 * Shared, browser-safe facts about saved intake progress.
 *
 * A half-finished brief is the most fragile thing a client gives us: they type
 * for ten minutes, close the laptop, and expect it to still be there. Drafts
 * therefore live on the server — keyed to the account once it exists, and to a
 * private draft token before that — never only in this browser tab.
 */

/** How long a draft survives before it expires, in days. */
export const INTAKE_DRAFT_TTL_DAYS = 30;

/** Cookie holding the anonymous draft token. Set server-side, httpOnly. */
export const INTAKE_DRAFT_COOKIE = "tf_intake_draft";

/** Largest draft payload we accept, in bytes. */
export const MAX_INTAKE_DRAFT_BYTES = 256_000;

export const INTAKE_DRAFT_RESTORING_LABEL = "Restoring your draft";

export const INTAKE_DRAFT_EXPIRED_MESSAGE =
  `Your saved answers were more than ${INTAKE_DRAFT_TTL_DAYS} days old, so we cleared them. ` +
  "Nothing was submitted — you can start the brief again below.";

export const INTAKE_DRAFT_SUBMITTED_MESSAGE =
  "You've already submitted this brief, so we're not restoring the old draft. " +
  "Anything you type now starts a new role.";

export const INTAKE_DRAFT_SAVE_ERROR_MESSAGE =
  "We could not save that — your answers are still on screen. We'll keep trying.";

/** Human phrasing for a real save time. Never used to claim an unfinished save. */
export function savedAtLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Saved";
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return "Saved just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Saved ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  return `Saved at ${then.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/** Fields we never persist, whatever the caller sends. */
export const NEVER_PERSISTED_DRAFT_FIELDS = [
  "password",
  "confirmPassword",
  "consent",
  "pilotAcknowledgement",
  "companyFax",
] as const;

export function stripNeverPersisted<T extends Record<string, unknown>>(
  payload: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  for (const key of NEVER_PERSISTED_DRAFT_FIELDS) delete out[key];
  return out;
}
