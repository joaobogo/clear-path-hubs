/**
 * Seat-limit messaging.
 *
 * A seat refusal can arrive from three places, and each one phrases it
 * differently:
 *
 *   1. `inviteClientMember` — a friendly sentence written for the client.
 *   2. `tg_memberships_guard` — a Postgres `check_violation` reading
 *      `seat_limit_exceeded: organization allows 1 owner seat plus 3 recruiter
 *      seats`. The database is the real boundary, so this is what surfaces on
 *      any path the app-level check does not cover (reactivating a suspended
 *      teammate, a staff-side write, a direct API call).
 *   3. A future write path nobody has added the friendly check to yet.
 *
 * A client should never read raw trigger text, and "adding a user beyond the
 * cap" has to end in an actionable next step rather than a dead end. This
 * module recognises all three shapes and returns one piece of copy.
 *
 * Seats are not self-serve: `client_seat_limit` is capped at
 * MAX_CLIENT_SEAT_LIMIT and only platform staff can raise it, so the prompt
 * asks for the plan conversation instead of promising an instant upgrade
 * button that does not exist.
 */

/** Raised by the database guard on every over-cap write. */
export const SEAT_LIMIT_DB_CODE = "seat_limit_exceeded";

/** Substrings that identify a seat refusal, whatever raised it. */
const SEAT_LIMIT_SIGNALS = [SEAT_LIMIT_DB_CODE, "seat limit reached", "seat_limit"];

export function isSeatLimitError(error: unknown): boolean {
  const text =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const haystack = text.toLowerCase();
  return SEAT_LIMIT_SIGNALS.some((signal) => haystack.includes(signal));
}

/**
 * The one sentence shown wherever a seat runs out — invite dialog, teammate
 * reactivation, or the header state. Kept free of raw error text so a
 * Postgres message never reaches a client.
 */
export function seatLimitMessage(usage?: { seatsUsed?: number; seatLimit?: number | null }): string {
  const limit = usage?.seatLimit;
  const used = usage?.seatsUsed;
  const scope =
    typeof limit === "number" && limit > 0
      ? typeof used === "number"
        ? `all ${limit} seat${limit === 1 ? "" : "s"} on your plan are in use (${used} of ${limit})`
        : `all ${limit} seat${limit === 1 ? "" : "s"} on your plan are in use`
      : "every seat on your plan is in use";
  return `Your workspace is at its seat limit — ${scope}. A pending invitation holds a seat, so cancelling one frees it up. To add more seats, talk to us about your plan.`;
}


/** Maps any error from a seat-consuming action to copy safe to show a client. */
export function seatAwareErrorMessage(
  error: unknown,
  usage?: { seatsUsed?: number; seatLimit?: number | null },
  fallback = "Something went wrong. Try again.",
): string {
  if (isSeatLimitError(error)) return seatLimitMessage(usage);
  const raw = (error instanceof Error ? error.message : String(error ?? "")).replace(
    /^Error:\s*/,
    "",
  );
  return raw.trim() || fallback;
}
