/**
 * The same business figures, for many organizations at once.
 *
 * Staff surfaces list every account side by side, so they cannot call the
 * per-organization readers one row at a time. They read here instead — and this
 * file owns no rules of its own: it batches the reads and then applies the
 * exact predicates the single-organization readers apply (`role-counts`,
 * `client-seats`, `candidates-in-play`, `hires/confirmed`). A stored count on
 * the organization row is never consulted, so adding or suspending a
 * membership, closing a role or confirming a hire changes every screen on the
 * next load with nothing to update.
 */
import { countClientRoles } from "@/lib/client/role-counts";
import { computeSeatCount, type SeatCount } from "@/lib/client-seats";
import { selectCandidatesInPlay } from "@/lib/kpis/candidates-in-play.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type OrgRollup = {
  roles_open: number;
  roles_total: number;
  candidates_delivered: number;
  candidates_in_play: number;
  candidates_total: number;
  confirmed_hires: number;
  seats: SeatCount;
};

function empty(seatLimit: number | null): OrgRollup {
  return {
    roles_open: 0,
    roles_total: 0,
    candidates_delivered: 0,
    candidates_in_play: 0,
    candidates_total: 0,
    confirmed_hires: 0,
    seats: computeSeatCount([], seatLimit),
  };
}

/**
 * One rollup per organization id. Missing ids come back as zeroes rather than
 * absent, so a caller can print a figure without a fallback of its own.
 */
export async function readOrgRollups(
  supabase: AnyRow,
  orgIds: readonly string[],
  seatLimitByOrg?: Readonly<Record<string, number | null>>,
): Promise<Record<string, OrgRollup>> {
  const ids = Array.from(new Set(orgIds.filter(Boolean).map(String)));
  const out: Record<string, OrgRollup> = {};
  for (const id of ids) out[id] = empty(seatLimitByOrg?.[id] ?? null);
  if (ids.length === 0) return out;

  const { normalizeOfferRecords, selectConfirmedHires } = await import(
    "@/lib/hires/confirmed"
  );

  const [roles, matches, members, hires] = await Promise.all([
    supabase
      .from("positions")
      .select("organization_id, status, title, is_test_record")
      .in("organization_id", ids),
    supabase
      .from("candidate_matches")
      .select("organization_id, id, stage, client_visibility, is_test_record")
      .in("organization_id", ids),
    supabase
      .from("memberships")
      .select("organization_id, role, status")
      .in("organization_id", ids),
    supabase
      .from("hire_records")
      .select("organization_id, status")
      .in("organization_id", ids),
  ]);

  const bucket = <T extends { organization_id?: unknown }>(rows: T[] | null) => {
    const map = new Map<string, T[]>();
    for (const id of ids) map.set(id, []);
    for (const row of rows ?? []) {
      const list = map.get(String(row.organization_id ?? ""));
      if (list) list.push(row);
    }
    return map;
  };

  const rolesByOrg = bucket((roles?.data ?? null) as AnyRow[] | null);
  const matchesByOrg = bucket((matches?.data ?? null) as AnyRow[] | null);
  const membersByOrg = bucket((members?.data ?? null) as AnyRow[] | null);
  const hiresByOrg = bucket((hires?.data ?? null) as AnyRow[] | null);

  for (const id of ids) {
    const roleRows = rolesByOrg.get(id) ?? [];
    const matchRows = (matchesByOrg.get(id) ?? []).filter(
      (m: AnyRow) => m.is_test_record !== true,
    );
    const visible = matchRows.filter(
      (m: AnyRow) => String(m.client_visibility ?? "") === "visible",
    );
    const counted = countClientRoles(roleRows);
    out[id] = {
      roles_open: counted.open,
      roles_total: counted.total,
      candidates_delivered: visible.length,
      candidates_in_play: selectCandidatesInPlay(visible).length,
      candidates_total: matchRows.length,
      confirmed_hires: selectConfirmedHires(
        normalizeOfferRecords(hiresByOrg.get(id) ?? []) as Array<{ status: string }>,
      ).length,
      seats: computeSeatCount(
        (membersByOrg.get(id) ?? []) as AnyRow[],
        seatLimitByOrg?.[id] ?? null,
      ),
    };
  }

  return out;
}
