/**
 * Portfolio rollup — the one reader.
 *
 * Business-unit and region rollups used to come from a database view that
 * counted hires by pipeline stage and "open" positions by its own status list.
 * A stored aggregate always drifts from the rows it summarises, so every figure
 * here is derived from the same canonical readers the dashboards use: open
 * roles from the role reader, candidates in play from the visible-match reader,
 * confirmed hires from the offer records.
 */
import { readOrgRows } from "@/lib/kpis/org-read.server";
import { selectClientRoles, selectOpenClientRoles } from "@/lib/client/role-counts";
import {
  loadVisibleMatches,
  selectCandidatesInPlay,
} from "@/lib/kpis/candidates-in-play.server";
import {
  indexConfirmedHires,
  loadConfirmedHires,
} from "@/lib/kpis/confirmed-hires.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const UNASSIGNED = "Unassigned";

const ROLE_SELECT =
  "id, title, status, openings, is_test_record, created_at, updated_at, business_unit, region";

export type PortfolioRollupRow = {
  portfolio_org_id: string;
  organization_id: string;
  organization_name: string;
  business_unit: string;
  region: string;
  open_positions: number;
  filled_positions: number;
  candidates_in_flight: number;
  hires: number;
};

type OrgRef = {
  id: string;
  name: string;
  parent_organization_id?: string | null;
};

/** Rollup rows for one organization, grouped by business unit and region. */
export async function loadPortfolioRollupForOrg(
  supabase: AnyRow,
  org: OrgRef,
): Promise<PortfolioRollupRow[]> {
  const [roleRows, matchRows, hireRows] = await Promise.all([
    readOrgRows(supabase, org.id, "positions", ROLE_SELECT),
    loadVisibleMatches(supabase, org.id),
    loadConfirmedHires(supabase, org.id),
  ]);

  const roles = selectClientRoles(roleRows as AnyRow[]);
  const openIds = new Set(selectOpenClientRoles(roles).map((r: AnyRow) => String(r.id)));
  const hires = indexConfirmedHires(hireRows);
  const inPlay = selectCandidatesInPlay(matchRows);

  const group = new Map<string, PortfolioRollupRow>();
  const keyOf = (bu: string, region: string) => `${bu}\u0000${region}`;
  const bucket = (bu: string, region: string): PortfolioRollupRow => {
    const key = keyOf(bu, region);
    const existing = group.get(key);
    if (existing) return existing;
    const created: PortfolioRollupRow = {
      portfolio_org_id: org.parent_organization_id ?? org.id,
      organization_id: org.id,
      organization_name: org.name,
      business_unit: bu,
      region,
      open_positions: 0,
      filled_positions: 0,
      candidates_in_flight: 0,
      hires: 0,
    };
    group.set(key, created);
    return created;
  };

  const placeOf = new Map<string, { bu: string; region: string }>();
  for (const role of roles as AnyRow[]) {
    const bu = String(role.business_unit ?? "") || UNASSIGNED;
    const region = String(role.region ?? "") || UNASSIGNED;
    placeOf.set(String(role.id), { bu, region });
    const row = bucket(bu, region);
    if (openIds.has(String(role.id))) row.open_positions += 1;
    if (String(role.status ?? "") === "filled") row.filled_positions += 1;
    row.hires += hires.positionCounts.get(String(role.id)) ?? 0;
  }

  for (const match of inPlay as AnyRow[]) {
    const place = placeOf.get(String(match.position_id)) ?? {
      bu: UNASSIGNED,
      region: UNASSIGNED,
    };
    bucket(place.bu, place.region).candidates_in_flight += 1;
  }

  return [...group.values()];
}

/** Rollup rows across several organizations of a portfolio tree. */
export async function loadPortfolioRollup(
  supabase: AnyRow,
  orgs: readonly OrgRef[],
): Promise<PortfolioRollupRow[]> {
  const perOrg = await Promise.all(
    orgs.map((org) => loadPortfolioRollupForOrg(supabase, org)),
  );
  return perOrg.flat();
}

/** Open roles per organization id, for account tables. */
export async function countOpenRolesByOrg(
  supabase: AnyRow,
  orgs: readonly OrgRef[],
): Promise<Map<string, number>> {
  const rows = await loadPortfolioRollup(supabase, orgs);
  const byOrg = new Map<string, number>();
  for (const row of rows) {
    byOrg.set(
      row.organization_id,
      (byOrg.get(row.organization_id) ?? 0) + row.open_positions,
    );
  }
  return byOrg;
}
