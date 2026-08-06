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
};

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

  // A failed read is a failure, never a silent "no access".
  if (staffRes?.error) throw new Error(staffRes.error.message);
  if (memberRes?.error) throw new Error(memberRes.error.message);

  const isStaff = staffRes?.data === true;
  const role = (memberRes?.data?.role as string | undefined) ?? null;
  const isMember = Boolean(role);

  return {
    allowed: isMember || isStaff,
    role,
    isStaff,
    isMember,
    isAdmin: role === "client_admin" || isStaff,
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
