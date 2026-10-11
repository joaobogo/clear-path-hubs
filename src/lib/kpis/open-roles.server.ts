/**
 * Open roles — the one reader.
 *
 * "Open" means the workspace is actively being served on the role. Drafts and
 * archived roles belong to the account but are never open; test fixtures are
 * never counted at all. The client Account tile, the Roles page, Insights and
 * the admin account view all read this, so they cannot disagree.
 */
import { readOrgRows } from "@/lib/kpis/org-read.server";
import {
  countClientRoles,
  selectClientRoles,
  selectOpenClientRoles,
} from "@/lib/client/role-counts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const SELECT = "id, title, status, openings, is_test_record, created_at, updated_at";

/** Every role of the account, as the account's own people see it. */
export async function loadOrgRoles(
  supabase: AnyRow,
  orgId: string,
): Promise<AnyRow[]> {
  return selectClientRoles(await readOrgRows(supabase, orgId, "positions", SELECT));
}

/** Roles actively being served. */
export async function loadOpenRoles(
  supabase: AnyRow,
  orgId: string,
): Promise<AnyRow[]> {
  return selectOpenClientRoles(await loadOrgRoles(supabase, orgId));
}

/**
 * `{ open, total }` for one organization.
 *
 * Reads every role of the organization, not `loadOrgRoles`: `total` counts
 * drafts and archived roles too, because they belong to the account and the
 * Roles page lists them under "All". Only test records are left out. Passing
 * the pre-filtered roles made `total` drop drafts and archived roles here
 * while the admin rollup (`org-rollups.server.ts`) counted them, so the same
 * account had two totals. `open` is unchanged either way.
 */
export async function countRolesForOrg(
  supabase: AnyRow,
  orgId: string,
): Promise<{ open: number; total: number }> {
  return countClientRoles(await readOrgRows(supabase, orgId, "positions", SELECT));
}

export async function countOpenRolesForOrg(
  supabase: AnyRow,
  orgId: string,
): Promise<number> {
  return (await loadOpenRoles(supabase, orgId)).length;
}
