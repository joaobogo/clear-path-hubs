// Seat-cap enforcement shared by every membership write that consumes a seat.
//
// The database trigger `tg_memberships_guard` is the real boundary, but it can
// only raise a Postgres `check_violation` that reads `seat_limit_exceeded: ...`.
// This helper runs first so the client gets a sentence written for them, and so
// every seat-consuming path (new invitation, reactivating a suspended
// teammate) refuses identically instead of one path leaking trigger text.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Roles that occupy a workspace seat. Candidates and staff never do. */
const SEAT_ROLES = ["client_admin", "client_editor", "client_viewer"] as const;

/** Statuses that hold a seat. `invited` reserves one; `suspended` releases it. */
const SEAT_STATUSES = ["active", "invited"] as const;

export async function readSeatUsage(
  orgId: string,
): Promise<{ seatLimit: number; seatsUsed: number; seatsLeft: number }> {
  const [{ data: org }, { data: rows }] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select("client_seat_limit")
      .eq("id", orgId)
      .maybeSingle(),
    supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("organization_id", orgId)
      .in("role", SEAT_ROLES as unknown as string[])
      .in("status", SEAT_STATUSES as unknown as string[]),
  ]);
  const recruiterSeats =
    (org as { client_seat_limit?: number | null } | null)?.client_seat_limit ?? 3;
  // The owner seat sits on top of the recruiter allowance, matching the
  // database guard's `recruiter seats + 1`.
  const seatLimit = recruiterSeats + 1;
  const seatsUsed = ((rows as { id: string }[] | null) ?? []).length;
  return { seatLimit, seatsUsed, seatsLeft: Math.max(0, seatLimit - seatsUsed) };
}

/**
 * Throws when the workspace has no seat left. The message carries the
 * `seat limit reached` marker that `src/lib/seat-limit.ts` recognises, so the
 * UI renders the upgrade prompt rather than echoing this string verbatim.
 */
export async function assertSeatAvailable(orgId: string): Promise<void> {
  const { seatLimit, seatsUsed } = await readSeatUsage(orgId);
  if (seatsUsed >= seatLimit) {
    throw new Error(
      `Seat limit reached — your plan includes ${seatLimit} seats and all ${seatsUsed} are in use (pending invitations hold a seat). Remove a teammate to free a seat, or talk to us about adding seats.`,
    );
  }
}
