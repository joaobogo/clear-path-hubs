// Seat-cap enforcement shared by every membership write that consumes a seat.
//
// The database trigger `tg_memberships_guard` is the real boundary, but it can
// only raise a Postgres `check_violation` that reads `seat_limit_exceeded: ...`.
// This helper runs first so the client gets a sentence written for them, and so
// every seat-consuming path (new invitation, reactivating a suspended
// teammate) refuses identically instead of one path leaking trigger text.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { seatBlockCode, type SeatBlock } from "@/lib/seat-limit";
import { readSeatsForOrg } from "@/lib/kpis/seats.server";

export async function readSeatUsage(
  orgId: string,
): Promise<{ seatLimit: number; seatsUsed: number; seatsLeft: number }> {
  // One reader for seats (src/lib/kpis/seats.server.ts) — the Account page, the
  // authz endpoint and this guard must never produce different seat totals.
  const { seatLimit, seatsUsed, seatsLeft } = await readSeatsForOrg(
    supabaseAdmin,
    orgId,
  );
  return { seatLimit, seatsUsed, seatsLeft };
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

/**
 * Structured seat check for paths that should explain the refusal rather than
 * throw a sentence at it (reactivating a suspended teammate). Returns null when
 * a seat is free. The database guard still refuses independently; this only
 * decides what the client is told.
 */
export async function evaluateSeatBlock(
  orgId: string,
): Promise<SeatBlock | null> {
  // Limit, usage and the invited/active split all come from the one seat
  // reader, so a refusal explains itself with the same numbers the screens show.
  const usage = await readSeatsForOrg(supabaseAdmin, orgId);
  if (usage.seatsUsed < usage.seatLimit) return null;
  return { code: seatBlockCode(usage), usage };
}

/**
 * Audit trail for a refused reactivation.
 *
 * A seat refusal is a governance event: the admin was told no, and later
 * ("why couldn't we add them back in August?") someone has to see which seat
 * condition caused it, not just that a limit existed. Stored with the reason
 * code plus the counts measured at the moment of refusal, since those change.
 *
 * Best-effort: a missing audit row must never turn a clean refusal into an
 * error the admin has to interpret.
 */
export async function recordSeatBlockAudit(args: {
  orgId: string;
  actorUserId: string;
  targetUserId: string;
  block: SeatBlock;
}): Promise<void> {
  const { usage } = args.block;
  const { error } = await supabaseAdmin.from("audit_events").insert({
    organization_id: args.orgId,
    actor_user_id: args.actorUserId,
    entity_type: "membership",
    entity_id: args.targetUserId,
    action: "member_reactivation_blocked_seat_limit",
    after_state: {
      reason_code: args.block.code,
      seat_limit: usage.seatLimit ?? null,
      seats_used: usage.seatsUsed ?? null,
      pending_invites: usage.pendingInvites ?? null,
      active_members: usage.activeMembers ?? null,
      attempted_status: "active",
    },
  });
  if (error) console.error("[recordSeatBlockAudit]", error.message);
}
