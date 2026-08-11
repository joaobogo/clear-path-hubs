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

/** What the UI knows about seat consumption when it has to explain a refusal. */
export type SeatUsage = {
  seatsUsed?: number;
  seatLimit?: number | null;
  /** Invitations sent but not accepted — each one holds a seat. */
  pendingInvites?: number;
  /** Seat-holding members currently active, including the admin reading this. */
  activeMembers?: number;
};

export type SeatRemedyId = "cancel_invite" | "suspend_active" | "remove_member" | "add_seats";

export type SeatRemedy = {
  id: SeatRemedyId;
  /** Sentence shown in the blocked-reactivation dialog. */
  text: string;
  /** Present only when the remedy has something to point the admin at. */
  actionLabel?: string;
};

/**
 * The remedies that can actually free a seat for this workspace, in the order
 * they are offered.
 *
 * Scenario-dependent, because advice a workspace cannot act on is worse than
 * no advice: with no pending invitation there is none to cancel, and with the
 * admin as the only active member there is nobody to suspend. Unknown counts
 * (seat usage failed to load) fall back to the generic wording rather than
 * dropping the remedy.
 */
export function seatFreeRemedies(usage: SeatUsage = {}): SeatRemedy[] {
  const remedies: SeatRemedy[] = [];
  const pending = usage.pendingInvites;
  const active = usage.activeMembers;

  if (pending === undefined) {
    remedies.push({
      id: "cancel_invite",
      text: "Cancel a pending invitation — invitations hold a seat before they are accepted.",
    });
  } else if (pending > 0) {
    remedies.push({
      id: "cancel_invite",
      text: `Cancel one of the ${pending} pending invitation${pending === 1 ? "" : "s"} — an invitation holds a seat before it is accepted.`,
      actionLabel: "Cancel a pending invitation",
    });
  }

  if (active === undefined || active > 1) {
    remedies.push({
      id: "suspend_active",
      text: "Suspend an active teammate who no longer needs access. Suspended members keep their history but stop using a seat.",
      actionLabel: "Go to the team list",
    });
  }

  remedies.push({
    id: "remove_member",
    text: "Remove someone from the workspace. Their account is not deleted and they can be invited back later.",
  });

  remedies.push({
    id: "add_seats",
    text: "Or add seats to your plan — seat counts are set by us, so this is a quick conversation rather than a self-serve toggle.",
  });

  return remedies;
}

/**
 * Structured seat refusal.
 *
 * A thrown message is fine for a toast but useless for deciding *which*
 * explainer to render: the UI has to string-match, and it only knows the seat
 * counts it happened to have cached. So every seat-consuming server function
 * returns this shape instead of throwing, and the dialog renders from the
 * reason code plus the server's own counts.
 */
export type SeatBlockCode =
  /** Pending invitations are holding seats — cancelling one frees a seat now. */
  | "pending_invites_hold_seats"
  /** Every seat belongs to an active member — someone has to be suspended or removed. */
  | "all_seats_active"
  /** Seats are full but the composition could not be read; generic advice only. */
  | "seat_limit_reached";

export type SeatBlock = {
  code: SeatBlockCode;
  /** The counts the server saw, so the dialog never quotes stale cached numbers. */
  usage: SeatUsage;
};

/** Result shape of a seat-consuming server function. */
export type SeatActionResult = { ok: true } | { ok: false; seatBlock: SeatBlock };

/** Narrows a server-function result to a structured refusal. */
export function isSeatBlocked(
  result: unknown,
): result is { ok: false; seatBlock: SeatBlock } {
  if (!result || typeof result !== "object") return false;
  const r = result as { ok?: unknown; seatBlock?: unknown };
  return r.ok === false && !!r.seatBlock && typeof r.seatBlock === "object";
}

/** Derives the reason code from the seat composition the server measured. */
export function seatBlockCode(usage: SeatUsage): SeatBlockCode {
  if (typeof usage.pendingInvites !== "number") return "seat_limit_reached";
  return usage.pendingInvites > 0 ? "pending_invites_hold_seats" : "all_seats_active";
}

/** One-line reason shown under the dialog title, chosen by reason code. */
export function seatBlockReason(block: SeatBlock): string {
  const { usage } = block;
  const counts =
    typeof usage.seatLimit === "number" && usage.seatLimit > 0
      ? `${usage.seatsUsed ?? usage.seatLimit} of ${usage.seatLimit} seats are in use`
      : "every seat on your plan is in use";
  switch (block.code) {
    case "pending_invites_hold_seats":
      return `A reactivated teammate takes a seat, and ${counts} — ${usage.pendingInvites} pending invitation${usage.pendingInvites === 1 ? "" : "s"} still hold${usage.pendingInvites === 1 ? "s" : ""} a seat.`;
    case "all_seats_active":
      return `A reactivated teammate takes a seat, and ${counts} — every one belongs to an active teammate.`;
    default:
      return `A reactivated teammate takes a seat, and your workspace has none free — ${counts}.`;
  }
}
