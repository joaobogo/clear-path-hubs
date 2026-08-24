/**
 * The one selector for confirmed hires.
 *
 * Every surface that prints a hire number — Offers, Roles, Candidates, Account
 * and Insights — reads this. The offer record is the only evidence of a hire:
 * pipeline stage, KPI view aggregates and lane counts never decide it.
 */
import { selectConfirmedHires } from "@/lib/hires/confirmed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type ConfirmedHireRow = {
  id: string;
  status: string;
  organization_id: string;
  position_id: string | null;
  candidate_match_id: string | null;
  candidate_profile_id: string | null;
  hired_at: string | null;
  start_date: string | null;
};

const SELECT =
  "id, status, organization_id, position_id, candidate_match_id, candidate_profile_id, hired_at, start_date";

/**
 * Every offer record for one organization, read the same way for every surface.
 *
 * Row-level visibility on an individual candidate match decides what a client
 * may open, never how many hires their account has closed. Reading the offer
 * records once, scoped strictly to the organization the caller is a member of,
 * is what keeps Offers, Roles, Candidates, Account and Insights on one number.
 */
export async function loadOfferRecords(
  supabase: AnyRow,
  orgId: string,
  select: string = SELECT,
): Promise<AnyRow[]> {
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("organization_id", orgId)
    .limit(1);
  const isMember = (((membership as AnyRow[]) ?? []).length ?? 0) > 0;
  if (isMember) {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data } = await supabaseAdmin
      .from("hire_records")
      .select(select as never)
      .eq("organization_id", orgId);
    return ((data as AnyRow[]) ?? []) as AnyRow[];
  }
  // Platform staff hold no membership row; their own read is already org-wide.
  const { data } = await supabase
    .from("hire_records")
    .select(select)
    .eq("organization_id", orgId);
  return ((data as AnyRow[]) ?? []) as AnyRow[];
}

/** Confirmed hire records for one organization. */
export async function loadConfirmedHires(
  supabase: AnyRow,
  orgId: string,
): Promise<ConfirmedHireRow[]> {
  const rows = await loadOfferRecords(supabase, orgId);
  return selectConfirmedHires(rows as ConfirmedHireRow[]);
}

/** How many confirmed hires the organization has. */
export async function countConfirmedHiresForOrg(
  supabase: AnyRow,
  orgId: string,
): Promise<number> {
  return (await loadConfirmedHires(supabase, orgId)).length;
}

/**
 * Index of confirmed hires so row-level code can ask "is this candidate a
 * confirmed hire?" without a second query.
 */
export function indexConfirmedHires(rows: readonly ConfirmedHireRow[]): {
  matchIds: Set<string>;
  pairs: Set<string>;
  positionCounts: Map<string, number>;
} {
  const matchIds = new Set<string>();
  const pairs = new Set<string>();
  const positionCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.candidate_match_id) matchIds.add(String(r.candidate_match_id));
    if (r.position_id && r.candidate_profile_id) {
      pairs.add(`${r.position_id}:${r.candidate_profile_id}`);
    }
    if (r.position_id) {
      positionCounts.set(
        String(r.position_id),
        (positionCounts.get(String(r.position_id)) ?? 0) + 1,
      );
    }
  }
  return { matchIds, pairs, positionCounts };
}
