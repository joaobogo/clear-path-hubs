// Server-side authorization assertions for TaaSFlow.
//
// These helpers are the application-layer half of the canonical authorization
// model. They are deliberately thin wrappers over the database's SECURITY
// DEFINER helpers so there is exactly one definition of each rule:
//
//   is_platform_staff(uuid)                  → TaaSFlow internal staff
//   is_org_member/editor/admin(uuid, uuid)   → client organization membership
//   has_client_permission(uuid, uuid, perm)  → granular seat permission
//   is_match_client_visible(uuid, uuid)      → candidate approved for this client+job
//   is_match_contact_released(uuid, uuid)    → contact details released
//
// RLS enforces all of the above independently; these assertions exist so server
// functions fail fast with an intentional error instead of silently returning
// an empty result set.

import type { ClientPermission } from "@/lib/authz";

// The authenticated Supabase client injected by `requireSupabaseAuth`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export class AuthorizationError extends Error {
  readonly status = 403;
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

const denied = (code: string, message?: string): never => {
  throw new AuthorizationError(code, message);
};

async function rpcBool(db: Db, fn: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data === true;
}

// ─── Platform staff ─────────────────────────────────────────────────────────

export async function isPlatformStaff(db: Db, userId: string) {
  return rpcBool(db, "is_platform_staff", { _user: userId });
}

export async function isPlatformAdmin(db: Db, userId: string) {
  return rpcBool(db, "is_platform_admin", { _user: userId });
}

export async function assertPlatformStaff(db: Db, userId: string) {
  if (!(await isPlatformStaff(db, userId))) {
    denied("forbidden_platform_staff", "This action requires TaaSFlow staff access.");
  }
}

export async function assertPlatformAdmin(db: Db, userId: string) {
  if (!(await isPlatformAdmin(db, userId))) {
    denied("forbidden_platform_admin", "This action requires a TaaSFlow administrator.");
  }
}

// ─── Client organization membership ─────────────────────────────────────────

export async function assertOrgMember(db: Db, userId: string, orgId: string) {
  if (await rpcBool(db, "is_org_member", { _user: userId, _org: orgId })) return;
  if (await isPlatformStaff(db, userId)) return;
  denied("forbidden_org_member", "You do not have access to this organization.");
}

export async function assertOrgEditor(db: Db, userId: string, orgId: string) {
  if (await rpcBool(db, "is_org_editor", { _user: userId, _org: orgId })) return;
  if (await isPlatformStaff(db, userId)) return;
  denied("forbidden_org_editor", "You need edit access in this organization.");
}

export async function assertOrgAdmin(db: Db, userId: string, orgId: string) {
  if (await rpcBool(db, "is_org_admin", { _user: userId, _org: orgId })) return;
  if (await isPlatformStaff(db, userId)) return;
  denied("forbidden_org_admin", "You need owner access in this organization.");
}

// ─── Granular seat permissions ──────────────────────────────────────────────

export async function hasPermission(
  db: Db,
  userId: string,
  orgId: string,
  permission: ClientPermission,
) {
  return rpcBool(db, "has_client_permission", {
    _user: userId,
    _org: orgId,
    _permission: permission,
  });
}

export async function assertPermission(
  db: Db,
  userId: string,
  orgId: string,
  permission: ClientPermission,
) {
  if (await hasPermission(db, userId, orgId, permission)) return;
  if (await isPlatformStaff(db, userId)) return;
  denied(
    `forbidden_permission_${permission}`,
    `Your seat does not include the "${permission.replace(/_/g, " ")}" permission.`,
  );
}

// ─── Candidate visibility (approval-scoped) ─────────────────────────────────

/**
 * A candidate is only visible to a client once an authorized admin approved
 * that exact candidate for that exact job + organization. Staff always see it.
 */
export async function assertMatchVisible(db: Db, userId: string, matchId: string) {
  if (await isPlatformStaff(db, userId)) return;
  if (await rpcBool(db, "is_match_client_visible", { _user: userId, _match: matchId })) {
    return;
  }
  // Deliberately identical to a "not found" outcome so the existence of an
  // unapproved candidate is never inferable from the error.
  denied("not_found", "Candidate not found.");
}

/** Contact release is a permission separate from client-view approval. */
export async function assertContactReleased(db: Db, userId: string, matchId: string) {
  if (await isPlatformStaff(db, userId)) return;
  if (await rpcBool(db, "is_match_contact_released", { _user: userId, _match: matchId })) {
    return;
  }
  denied(
    "contact_not_released",
    "Contact details for this candidate have not been released yet.",
  );
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export type AuthzAuditEntry = {
  actorUserId: string;
  organizationId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

/**
 * Records role, permission, approval and contact-release changes. Uses the
 * service client so an audit row is always written even when the actor could
 * not read the target row back under RLS. Never throws — a failed audit write
 * must not roll back an otherwise-authorized action, but it is logged.
 */
export async function logAuthzChange(entry: AuthzAuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: entry.actorUserId,
      organization_id: entry.organizationId ?? null,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      action: entry.action,
      before_state: (entry.before ?? null) as never,
      after_state: ({
        ...(entry.after && typeof entry.after === "object" ? entry.after : { value: entry.after ?? null }),
        reason: entry.reason ?? null,
      }) as never,

    });
  } catch (err) {
    console.error("[authz] audit write failed", entry.action, entry.entityId, err);
  }
}
