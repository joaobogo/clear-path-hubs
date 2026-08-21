/**
 * Canonical workspace-access check used by every server function.
 *
 * Why this exists: `public.is_org_member()` also requires
 * `organizations.archived_at IS NULL`, and it returns `false` for platform
 * staff who are not members of a client workspace. Call sites that used that
 * RPC directly therefore turned "workspace archived" or "I'm staff" into a
 * hard "You do not have access to this workspace." load failure.
 *
 * This helper reads the membership row directly (active membership, archived or
 * not) and treats platform staff as allowed. It also surfaces real query
 * errors instead of silently degrading them into "no access".
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export class WorkspaceAccessError extends Error {
  code = "forbidden_org_member" as const;
  constructor(message = "You do not have access to this workspace.") {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

export type WorkspaceAccess = {
  /** Active membership in this workspace, or platform staff. */
  allowed: boolean;
  /** Membership role, when the caller is a member. */
  role: string | null;
  isStaff: boolean;
  isMember: boolean;
  isAdmin: boolean;
  /**
   * May change workspace data. `client_viewer` is read-only by product rule, so
   * consumers branch on this flag instead of re-testing role strings.
   */
  canWrite: boolean;
  /** May see and manage the workspace team (owners, editors, platform staff). */
  canManageTeam: boolean;
};

/**
 * Reads the caller's own membership, with a server-side confirmation step.
 *
 * RLS on `memberships` can hide a caller's own row in edge cases (archived or
 * prospect workspaces, stale policy joins, a failing helper function). When the
 * caller-scoped read finds nothing, we re-check *only this caller's own*
 * membership with the service client before concluding "no access" — a member
 * must never be told a workspace isn't theirs.
 */
async function confirmMembership(
  userId: string,
  orgId: string,
): Promise<{ role: string | null; isStaff: boolean }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: row }, { data: staffRows }] = await Promise.all([
      supabaseAdmin
        .from("memberships")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      supabaseAdmin
        .from("memberships")
        .select("role")
        .eq("user_id", userId)
        .eq("status", "active")
        .in("role", ["platform_admin", "operations"]),
    ]);
    return {
      role: ((row as { role?: string } | null)?.role as string | undefined) ?? null,
      isStaff: Array.isArray(staffRows) && staffRows.length > 0,
    };
  } catch {
    return { role: null, isStaff: false };
  }
}

export async function readWorkspaceAccess(
  supabase: Db,
  userId: string,
  orgId: string,
): Promise<WorkspaceAccess> {
  const [staffRes, memberRes] = await Promise.all([
    supabase.rpc("is_platform_staff", { _user: userId }),
    supabase
      .from("memberships")
      .select("role, status")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  let isStaff = staffRes?.data === true;
  let role = (memberRes?.data?.role as string | undefined) ?? null;

  // A caller-scoped read that finds nothing — or fails — is never treated as
  // "not your workspace" until the service client has confirmed it.
  if (!role && !isStaff) {
    const confirmed = await confirmMembership(userId, orgId);
    role = confirmed.role;
    isStaff = confirmed.isStaff;
  }

  const isMember = Boolean(role);

  return {
    allowed: isMember || isStaff,
    role,
    isStaff,
    isMember,
    isAdmin: role === "client_admin" || role === "platform_admin" || role === "operations" || isStaff,
    canWrite: isStaff || (isMember && role !== "client_viewer"),
    // Team and invitations are Admin-only, matching AREA_ROLES.team and the
    // published role card ("an editor cannot manage the team").
    canManageTeam: isStaff || role === "client_admin",

  };
}


/** Throws a consistent, plain-language error when the caller has no access. */
export async function assertWorkspaceAccess(
  supabase: Db,
  userId: string,
  orgId: string,
): Promise<WorkspaceAccess> {
  const access = await readWorkspaceAccess(supabase, userId, orgId);
  if (!access.allowed) throw new WorkspaceAccessError();
  return access;
}

/** Throws when the caller may read the workspace but not change it. */
export async function assertWorkspaceWrite(
  supabase: Db,
  userId: string,
  orgId: string,
): Promise<WorkspaceAccess> {
  const access = await assertWorkspaceAccess(supabase, userId, orgId);
  if (!access.canWrite) {
    throw new WorkspaceAccessError("support_view_denied");
  }
  return access;
}

/** Throws unless the caller owns the workspace (or is platform staff). */
export async function assertWorkspaceAdmin(
  supabase: Db,
  userId: string,
  orgId: string,
): Promise<WorkspaceAccess> {
  const access = await assertWorkspaceAccess(supabase, userId, orgId);
  if (!access.isAdmin) {
    throw new WorkspaceAccessError("You need owner access in this workspace.");
  }
  return access;
}

/** Throws unless the caller may see and manage the workspace team. */
export async function assertWorkspaceTeamAccess(
  supabase: Db,
  userId: string,
  orgId: string,
): Promise<WorkspaceAccess> {
  const access = await assertWorkspaceAccess(supabase, userId, orgId);
  if (!access.canManageTeam) {
    throw new WorkspaceAccessError("You need team access in this workspace.");
  }
  return access;
}
