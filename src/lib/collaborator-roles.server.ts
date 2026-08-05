/**
 * Server-side enforcement of collaborator-role areas.
 *
 * The rule read here is the same `AREA_ROLES` map the UI renders from, so a
 * capability shown on /client/team is exactly the capability the server allows.
 * Role membership itself is read from the database (memberships row), never
 * from client input.
 */

import { AuthorizationError } from "@/lib/authz.server";
import {
  areaDeniedMessage,
  canAccessArea,
  type WorkspaceArea,
} from "@/lib/collaborator-roles";

// The authenticated Supabase client injected by `requireSupabaseAuth`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Reads the caller's effective role in this organisation, or null. */
export async function readWorkspaceRole(
  db: Db,
  userId: string,
  orgId: string,
): Promise<string | null> {
  const { data: staff } = await db.rpc("is_platform_staff", { _user: userId });
  if (staff === true) return "platform_admin";
  const { data: row } = await db
    .from("memberships")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (row?.role as string | undefined) ?? null;
}

export async function assertWorkspaceArea(
  db: Db,
  userId: string,
  orgId: string,
  area: WorkspaceArea,
): Promise<string> {
  const role = await readWorkspaceRole(db, userId, orgId);
  if (!role) {
    throw new AuthorizationError("forbidden_org_member", "You do not have access to this workspace.");
  }
  if (!canAccessArea(role, area)) {
    throw new AuthorizationError(`forbidden_area_${area}`, areaDeniedMessage(area));
  }
  return role;
}
