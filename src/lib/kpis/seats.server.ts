/**
 * Seats in use — the one reader.
 *
 * Membership visibility is not the seat count: a viewer who cannot list their
 * colleagues still has to see the same "2 of 4" the owner and staff see. Rows
 * come through the organization-scoped reader and the totals through the one
 * derivation in `client-seats.ts`, which mirrors the database seat guard.
 */
import { readOrgRows, isOrgMember, isPlatformStaffCaller } from "@/lib/kpis/org-read.server";
import { computeSeatCount, type SeatCount } from "@/lib/client-seats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type { SeatCount };

async function readSeatLimit(supabase: AnyRow, orgId: string): Promise<number | null> {
  let db: AnyRow = supabase;
  if ((await isOrgMember(supabase, orgId)) || (await isPlatformStaffCaller(supabase))) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    db = supabaseAdmin;
  }
  const { data, error } = await db
    .from("organizations")
    .select("client_seat_limit")
    .eq("id", orgId)
    .maybeSingle();
  // null is a real answer here — the account has no custom limit and takes the
  // default. A failed read is not that answer, and silently becoming "default
  // plan" is the wrong way for a billing number to degrade.
  if (error) {
    throw new Error(`seat_limit_read_failed: ${orgId}: ${(error as { message?: string })?.message ?? "unknown error"}`);
  }
  return ((data as AnyRow)?.client_seat_limit as number | null) ?? null;
}

export async function readSeatsForOrg(
  supabase: AnyRow,
  orgId: string,
): Promise<SeatCount> {
  const [members, seatLimit] = await Promise.all([
    readOrgRows(supabase, orgId, "memberships", "id, role, status"),
    readSeatLimit(supabase, orgId),
  ]);
  return computeSeatCount(members as AnyRow[], seatLimit);
}

export async function countSeatsInUse(
  supabase: AnyRow,
  orgId: string,
): Promise<number> {
  return (await readSeatsForOrg(supabase, orgId)).seatsUsed;
}
