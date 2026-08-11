/**
 * Carrying a seat shortfall into the plan flow.
 *
 * When an admin is refused a seat (invite or reactivation) the numbers behind
 * the refusal live in the team tab. Sending them to "Plan & billing" with no
 * context makes them re-derive it, so the seat position travels in the URL and
 * the plan tab states plainly what each plan would resolve.
 *
 * Seat counts per plan come from PLAN_SEAT_LIMITS (recruiter seats, excluding
 * the owner seat) — the same map staff use when setting client_seat_limit. No
 * seat number is invented here.
 */
import { PLAN_SEAT_LIMITS } from "@/lib/authz";
import type { SeatUsage } from "@/lib/seat-limit";

/** Seat position handed to the plan flow, all optional so a bare link still works. */
export type SeatUpgradeContext = {
  /** Seats consumed right now (active members + pending invitations). */
  seatsUsed?: number;
  /** Seats the current plan allows. */
  seatLimit?: number;
  /** Invitations holding a seat without being accepted yet. */
  seatsPending?: number;
  /** How many extra seats the blocked action needs. At least 1 when present. */
  seatsNeeded?: number;
};

/** URL search shape. Keys stay short because they are user-visible. */
export type SeatUpgradeSearch = {
  seatsUsed?: number;
  seatLimit?: number;
  seatsPending?: number;
  seatsNeeded?: number;
};

function positive(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/** Builds the search params for a "review your plan" / "upgrade" link. */
export function seatUpgradeSearch(
  usage: SeatUsage | undefined,
  seatsNeeded = 1,
): SeatUpgradeSearch {
  const limit = typeof usage?.seatLimit === "number" ? usage.seatLimit : undefined;
  const out: SeatUpgradeSearch = { seatsNeeded: Math.max(1, Math.floor(seatsNeeded)) };
  if (typeof usage?.seatsUsed === "number") out.seatsUsed = usage.seatsUsed;
  if (typeof limit === "number") out.seatLimit = limit;
  if (typeof usage?.pendingInvites === "number") out.seatsPending = usage.pendingInvites;
  return out;
}

/** Reads the seat context back out of route search, ignoring anything malformed. */
export function parseSeatUpgradeSearch(search: Record<string, unknown>): SeatUpgradeSearch {
  const out: SeatUpgradeSearch = {};
  const used = positive(search["seatsUsed"]);
  const limit = positive(search["seatLimit"]);
  const pending = positive(search["seatsPending"]);
  const needed = positive(search["seatsNeeded"]);
  if (used !== undefined) out.seatsUsed = used;
  if (limit !== undefined) out.seatLimit = limit;
  if (pending !== undefined) out.seatsPending = pending;
  if (needed !== undefined && needed > 0) out.seatsNeeded = needed;
  return out;
}

/** True when there is enough information to explain a shortfall. */
export function hasSeatContext(ctx: SeatUpgradeContext): boolean {
  return typeof ctx.seatsNeeded === "number" && ctx.seatsNeeded > 0;
}

/**
 * Seats the workspace is short by: what the blocked action needs minus what is
 * still free on the current plan. Unknown counts mean we only know the ask.
 */
export function seatShortfall(ctx: SeatUpgradeContext): number {
  const needed = ctx.seatsNeeded ?? 0;
  if (typeof ctx.seatLimit !== "number" || typeof ctx.seatsUsed !== "number") return needed;
  const free = Math.max(0, ctx.seatLimit - ctx.seatsUsed);
  return Math.max(0, needed - free);
}

/** Seat tier key for a catalogue plan, matching PLAN_SEAT_LIMITS. */
export function seatTierForProduct(productId: string): string | null {
  const map: Record<string, string> = {
    pilot: "pilot",
    multi_position: "multi",
    sprint_package: "sprint",
    subscription_bronze: "bronze",
    subscription_silver: "silver",
    subscription_gold: "gold",
    subscription_enterprise: "enterprise",
    enterprise: "enterprise",
  };
  return map[productId] ?? null;
}

/** Total seats a plan includes (owner seat + recruiter seats), or null if scoped. */
export function planTotalSeats(productId: string): number | null {
  const tier = seatTierForProduct(productId);
  if (!tier) return null;
  const recruiters = PLAN_SEAT_LIMITS[tier];
  return typeof recruiters === "number" ? recruiters + 1 : null;
}

/** Whether moving to a plan with `totalSeats` clears the shortfall immediately. */
export function planResolvesSeatNeed(
  totalSeats: number | null,
  ctx: SeatUpgradeContext,
): boolean {
  if (totalSeats === null) return false;
  const needed = ctx.seatsNeeded ?? 0;
  if (needed <= 0) return false;
  const used = typeof ctx.seatsUsed === "number" ? ctx.seatsUsed : 0;
  return totalSeats - used >= needed;
}

/** One line stating the current position, used above the plan list. */
export function seatContextSummary(ctx: SeatUpgradeContext): string {
  const needed = ctx.seatsNeeded ?? 1;
  const ask = `${needed} more seat${needed === 1 ? "" : "s"}`;
  if (typeof ctx.seatLimit === "number" && typeof ctx.seatsUsed === "number") {
    const pending =
      typeof ctx.seatsPending === "number" && ctx.seatsPending > 0
        ? `, including ${ctx.seatsPending} pending invitation${ctx.seatsPending === 1 ? "" : "s"}`
        : "";
    return `You are using ${ctx.seatsUsed} of ${ctx.seatLimit} seat${ctx.seatLimit === 1 ? "" : "s"}${pending}, and the action you tried needs ${ask}.`;
  }
  return `The action you tried needs ${ask} than your plan currently allows.`;
}
