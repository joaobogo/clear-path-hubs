/**
 * Canonical seat derivation — ONE definition of "how many seats does this
 * workspace have and how many are in use".
 *
 * Three places used to compute this independently (Account overview, the authz
 * seat endpoint, the team tab's server helper), and they disagreed: one read
 * `client_seat_limit` raw while the database guard allows an owner seat on top
 * of it, and one counted every membership including candidates and staff. The
 * result was "2/3" on one screen and "2 of 4" on another for the same team.
 *
 * The database guard `tg_memberships_guard` is the real boundary; this mirrors
 * it exactly: recruiter seats (`client_seat_limit`) plus one owner seat, held
 * by client-role memberships that are `active` or `invited`.
 */

/** Roles that occupy a workspace seat. Candidates and platform staff never do. */
export const SEAT_ROLES = ["client_admin", "client_editor", "client_viewer"] as const;

/** Statuses that hold a seat. `invited` reserves one; `suspended` releases it. */
export const SEAT_STATUSES = ["active", "invited"] as const;

/** Recruiter-seat allowance assumed when a workspace has no explicit value. */
export const DEFAULT_RECRUITER_SEATS = 3;

export type SeatMembershipRow = { role?: string | null; status?: string | null };

export type SeatCount = {
  /** Total seats on the plan: recruiter allowance + the owner seat. */
  seatLimit: number;
  seatsUsed: number;
  seatsLeft: number;
  activeMembers: number;
  pendingInvites: number;
};

export function holdsSeat(row: SeatMembershipRow & { profiles?: { email?: string | null } | null }): boolean {
  const email = row.profiles?.email?.toLowerCase() ?? "";
  const isInternal = email.endsWith("@taasflow.com");
  
  return (
    !isInternal &&
    (SEAT_ROLES as readonly string[]).includes(String(row.role ?? "")) &&
    (SEAT_STATUSES as readonly string[]).includes(String(row.status ?? ""))
  );
}

/**
 * Seat totals from raw membership rows. Pass every membership of the
 * workspace — filtering to seat-holders happens here so no caller can filter
 * differently.
 */
export function computeSeatCount(
  rows: SeatMembershipRow[],
  clientSeatLimit: number | null | undefined,
): SeatCount {
  const recruiterSeats = Number(clientSeatLimit ?? DEFAULT_RECRUITER_SEATS);
  const seatLimit =
    (Number.isFinite(recruiterSeats) ? Math.max(0, recruiterSeats) : DEFAULT_RECRUITER_SEATS) + 1;
  const holders = rows.filter(holdsSeat);
  const seatsUsed = holders.length;
  return {
    seatLimit,
    seatsUsed,
    seatsLeft: Math.max(0, seatLimit - seatsUsed),
    activeMembers: holders.filter((r) => r.status === "active").length,
    pendingInvites: holders.filter((r) => r.status === "invited").length,
  };
}
