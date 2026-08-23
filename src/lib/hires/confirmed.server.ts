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

/** Confirmed hire records for one organization. */
export async function loadConfirmedHires(
  supabase: AnyRow,
  orgId: string,
): Promise<ConfirmedHireRow[]> {
  const { data } = await supabase
    .from("hire_records")
    .select(SELECT)
    .eq("organization_id", orgId);
  return selectConfirmedHires(((data as AnyRow[]) ?? []) as ConfirmedHireRow[]);
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
