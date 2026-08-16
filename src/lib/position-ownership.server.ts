/**
 * Position ownership and coverage.
 *
 * Every open role should have an active owner and, ideally, a named backup.
 * When a staff member is deactivated, a database trigger flags their open
 * roles (`positions.needs_reassignment`) instead of silently orphaning them.
 * This module reads that queue, resolves owner/backup identities and their
 * active state, and applies owner changes with audit events.
 *
 * Deliberately absent: round-robin auto-assignment and capacity-based
 * auto-balancing. Reassignment is always an explicit human action.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any; rpc?: (n: string, a?: unknown) => any };

/** Statuses that still need an owner. */
export const OPEN_OWNERSHIP_STATUSES = [
  "submitted",
  "under_review",
  "needs_clarification",
  "approved",
  "active",
  "paused",
] as const;

export const OWNER_ASSIGN_ACTION = "position.owner_assigned";
export const BACKUP_ASSIGN_ACTION = "position.backup_owner_assigned";
export const BULK_REASSIGN_ACTION = "position.bulk_reassigned";

export type StaffOption = {
  user_id: string;
  name: string;
  email: string | null;
  role: string | null;
  is_active: boolean;
};

export type CoverageRow = {
  position_id: string;
  title: string;
  status: string;
  organization_id: string;
  organization_name: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_is_active: boolean;
  owner_assigned_at: string | null;
  backup_owner_user_id: string | null;
  backup_owner_name: string | null;
  backup_owner_is_active: boolean;
  backup_owner_assigned_at: string | null;
  needs_reassignment: boolean;
  reassignment_flagged_at: string | null;
  reassignment_reason: string | null;
  /** True when there is no owner at all, or the owner is inactive. */
  uncovered: boolean;
};

export type CoverageQueue = {
  rows: CoverageRow[];
  totals: {
    open_roles: number;
    flagged: number;
    no_owner: number;
    inactive_owner: number;
    no_backup: number;
  };
  generated_at: string;
};

function displayName(
  p: { full_name?: string | null; email?: string | null } | undefined,
  fallback: string,
): string {
  if (!p) return fallback;
  return p.full_name?.trim() || p.email?.trim() || fallback;
}

/**
 * Staff who can own a role: platform admins and operations users with an
 * active membership and a non-suspended profile.
 */
export async function loadStaffOptions(admin: Admin): Promise<StaffOption[]> {
  const memberships = await admin
    .from("memberships")
    .select("user_id, role, status")
    .in("role", ["platform_admin", "operations"]);
  if (memberships.error) throw new Error(memberships.error.message);

  const rows = (memberships.data ?? []) as Array<{
    user_id: string;
    role: string;
    status: string;
  }>;
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  if (ids.length === 0) return [];

  const profiles = await admin
    .from("profiles")
    .select("auth_user_id, full_name, email, status")
    .in("auth_user_id", ids);
  if (profiles.error) throw new Error(profiles.error.message);

  const profile = new Map(
    (
      (profiles.data ?? []) as Array<{
        auth_user_id: string;
        full_name: string | null;
        email: string | null;
        status: string;
      }>
    ).map((p) => [p.auth_user_id, p]),
  );

  const best = new Map<string, StaffOption>();
  for (const r of rows) {
    const p = profile.get(r.user_id);
    const active = r.status === "active" && (p?.status ?? "active") === "active";
    const prev = best.get(r.user_id);
    if (prev && prev.is_active && !active) continue;
    best.set(r.user_id, {
      user_id: r.user_id,
      name: displayName(p, "Unknown user"),
      email: p?.email ?? null,
      role: r.role,
      is_active: active,
    });
  }

  return Array.from(best.values()).sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

type PositionRow = {
  id: string;
  title: string;
  status: string;
  organization_id: string;
  owner_user_id: string | null;
  owner_assigned_at: string | null;
  backup_owner_user_id: string | null;
  backup_owner_assigned_at: string | null;
  needs_reassignment: boolean;
  reassignment_flagged_at: string | null;
  reassignment_reason: string | null;
};

async function resolvePeople(
  admin: Admin,
  ids: string[],
): Promise<Map<string, { name: string; is_active: boolean }>> {
  const out = new Map<string, { name: string; is_active: boolean }>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return out;

  const [profRes, memRes] = await Promise.all([
    admin
      .from("profiles")
      .select("auth_user_id, full_name, email, status")
      .in("auth_user_id", unique),
    admin.from("memberships").select("user_id, status").in("user_id", unique),
  ]);
  if (profRes.error) throw new Error(profRes.error.message);
  if (memRes.error) throw new Error(memRes.error.message);

  const memActive = new Set(
    ((memRes.data ?? []) as Array<{ user_id: string; status: string }>)
      .filter((m) => m.status === "active")
      .map((m) => m.user_id),
  );

  for (const id of unique) out.set(id, { name: "Unknown user", is_active: false });

  for (const p of (profRes.data ?? []) as Array<{
    auth_user_id: string;
    full_name: string | null;
    email: string | null;
    status: string;
  }>) {
    out.set(p.auth_user_id, {
      name: displayName(p, "Unknown user"),
      is_active: p.status === "active" && memActive.has(p.auth_user_id),
    });
  }
  return out;
}

/**
 * The coverage queue: open roles that are flagged for reassignment, have no
 * owner, or whose owner is no longer active. Pass `all: true` to list every
 * open role regardless of coverage.
 */
export async function loadCoverageQueue(
  admin: Admin,
  opts: { includeTest?: boolean; all?: boolean; q?: string } = {},
): Promise<CoverageQueue> {
  let q = admin
    .from("positions")
    .select(
      "id, title, status, organization_id, owner_user_id, owner_assigned_at, backup_owner_user_id, backup_owner_assigned_at, needs_reassignment, reassignment_flagged_at, reassignment_reason",
    )
    .in("status", OPEN_OWNERSHIP_STATUSES as unknown as string[])
    .order("updated_at", { ascending: false })
    .limit(500);
  const { resolveShowTestRecords } = await import("./admin-test-scope.server");
  const showTest = opts.includeTest === true || (await resolveShowTestRecords());
  if (!showTest) q.eq("is_test_record", false);
  if (opts.q) {
    const { buildPositionSearchOr } = await import("./search/postgrest-filter");
    const searchOr = await buildPositionSearchOr(admin as never, opts.q);
    if (searchOr) q = q.or(searchOr);
  }

  const res = await q;
  if (res.error) throw new Error(res.error.message);
  const positions = (res.data ?? []) as PositionRow[];

  const orgIds = Array.from(new Set(positions.map((p) => p.organization_id)));
  const [orgRes, people] = await Promise.all([
    orgIds.length
      ? admin.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [], error: null }),
    resolvePeople(admin, [
      ...positions.map((p) => p.owner_user_id ?? ""),
      ...positions.map((p) => p.backup_owner_user_id ?? ""),
    ]),
  ]);
  if ((orgRes as { error?: { message: string } | null }).error) {
    throw new Error((orgRes as { error: { message: string } }).error.message);
  }
  const orgName = new Map(
    ((orgRes.data ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]),
  );

  const all: CoverageRow[] = positions.map((p) => {
    const owner = p.owner_user_id ? people.get(p.owner_user_id) : undefined;
    const backup = p.backup_owner_user_id ? people.get(p.backup_owner_user_id) : undefined;
    const ownerActive = Boolean(p.owner_user_id && owner?.is_active);
    return {
      position_id: p.id,
      title: p.title,
      status: p.status,
      organization_id: p.organization_id,
      organization_name: orgName.get(p.organization_id) ?? null,
      owner_user_id: p.owner_user_id,
      owner_name: owner?.name ?? null,
      owner_is_active: ownerActive,
      owner_assigned_at: p.owner_assigned_at,
      backup_owner_user_id: p.backup_owner_user_id,
      backup_owner_name: backup?.name ?? null,
      backup_owner_is_active: Boolean(p.backup_owner_user_id && backup?.is_active),
      backup_owner_assigned_at: p.backup_owner_assigned_at,
      needs_reassignment: Boolean(p.needs_reassignment),
      reassignment_flagged_at: p.reassignment_flagged_at,
      reassignment_reason: p.reassignment_reason,
      uncovered: !ownerActive,
    };
  });

  const totals = {
    open_roles: all.length,
    flagged: all.filter((r) => r.needs_reassignment).length,
    no_owner: all.filter((r) => !r.owner_user_id).length,
    inactive_owner: all.filter((r) => r.owner_user_id && !r.owner_is_active).length,
    no_backup: all.filter((r) => !r.backup_owner_user_id).length,
  };

  const rows = opts.all
    ? all
    : all.filter((r) => r.needs_reassignment || r.uncovered);

  // Flagged and ownerless first, then oldest assignment.
  rows.sort((a, b) => {
    const rank = (r: CoverageRow) =>
      r.needs_reassignment ? 0 : !r.owner_user_id ? 1 : !r.owner_is_active ? 2 : 3;
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return (a.owner_assigned_at ?? "").localeCompare(b.owner_assigned_at ?? "");
  });

  return { rows, totals, generated_at: new Date().toISOString() };
}

export type BulkReassignPreview = {
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  to_name: string;
  to_is_active: boolean;
  items: Array<{
    position_id: string;
    title: string;
    organization_name: string | null;
    status: string;
    role_on_position: "owner" | "backup";
    /** Set when the target is already the other party on this role. */
    conflict: string | null;
  }>;
  skipped: Array<{ position_id: string; title: string; reason: string }>;
};

/** Dry run: exactly what a bulk reassign would change, nothing written. */
export async function previewBulkReassign(
  admin: Admin,
  input: { fromUserId: string; toUserId: string; includeBackup: boolean; includeTest?: boolean },
): Promise<BulkReassignPreview> {
  if (input.fromUserId === input.toUserId) {
    throw new Error("Choose two different people.");
  }

  const q = admin
    .from("positions")
    .select(
      "id, title, status, organization_id, owner_user_id, backup_owner_user_id",
    )
    .in("status", OPEN_OWNERSHIP_STATUSES as unknown as string[]);
  const { resolveShowTestRecords } = await import("./admin-test-scope.server");
  const showTest = input.includeTest === true || (await resolveShowTestRecords());
  if (!showTest) q.eq("is_test_record", false);
  const res = await q;
  if (res.error) throw new Error(res.error.message);

  const rows = ((res.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    organization_id: string;
    owner_user_id: string | null;
    backup_owner_user_id: string | null;
  }>).filter(
    (r) =>
      r.owner_user_id === input.fromUserId ||
      (input.includeBackup && r.backup_owner_user_id === input.fromUserId),
  );

  const orgIds = Array.from(new Set(rows.map((r) => r.organization_id)));
  const [orgRes, people] = await Promise.all([
    orgIds.length
      ? admin.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [], error: null }),
    resolvePeople(admin, [input.fromUserId, input.toUserId]),
  ]);
  if ((orgRes as { error?: { message: string } | null }).error) {
    throw new Error((orgRes as { error: { message: string } }).error.message);
  }
  const orgName = new Map(
    ((orgRes.data ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]),
  );

  const items: BulkReassignPreview["items"] = [];
  const skipped: BulkReassignPreview["skipped"] = [];

  for (const r of rows) {
    const isOwner = r.owner_user_id === input.fromUserId;
    if (isOwner) {
      items.push({
        position_id: r.id,
        title: r.title,
        organization_name: orgName.get(r.organization_id) ?? null,
        status: r.status,
        role_on_position: "owner",
        conflict:
          r.backup_owner_user_id === input.toUserId
            ? "Target is currently the backup — backup will be cleared."
            : null,
      });
      continue;
    }
    if (r.owner_user_id === input.toUserId) {
      skipped.push({
        position_id: r.id,
        title: r.title,
        reason: "Target already owns this role.",
      });
      continue;
    }
    items.push({
      position_id: r.id,
      title: r.title,
      organization_name: orgName.get(r.organization_id) ?? null,
      status: r.status,
      role_on_position: "backup",
      conflict: null,
    });
  }

  const from = people.get(input.fromUserId);
  const to = people.get(input.toUserId);

  return {
    from_user_id: input.fromUserId,
    from_name: from?.name ?? "Unknown user",
    to_user_id: input.toUserId,
    to_name: to?.name ?? "Unknown user",
    to_is_active: Boolean(to?.is_active),
    items,
    skipped,
  };
}

/** Applies the previewed reassignment and writes one audit event per role. */
export async function applyBulkReassign(
  admin: Admin,
  input: {
    fromUserId: string;
    toUserId: string;
    includeBackup: boolean;
    includeTest?: boolean;
    actorUserId: string;
    reason: string | null;
  },
): Promise<{ moved: number; skipped: number }> {
  const preview = await previewBulkReassign(admin, input);
  if (preview.items.length === 0) return { moved: 0, skipped: preview.skipped.length };

  const nowIso = new Date().toISOString();
  const audits: Array<Record<string, unknown>> = [];
  let moved = 0;

  for (const item of preview.items) {
    const patch: Record<string, unknown> =
      item.role_on_position === "owner"
        ? {
            owner_user_id: input.toUserId,
            needs_reassignment: false,
            reassignment_flagged_at: null,
            reassignment_reason: null,
          }
        : { backup_owner_user_id: input.toUserId };
    if (item.role_on_position === "owner" && item.conflict) {
      patch['backup_owner_user_id'] = null;
    }

    const upd = await admin.from("positions").update(patch).eq("id", item.position_id);
    if (upd.error) throw new Error(upd.error.message);
    moved += 1;

    audits.push({
      entity_type: "position",
      entity_id: item.position_id,
      action: BULK_REASSIGN_ACTION,
      actor_user_id: input.actorUserId,
      before_state: {
        [item.role_on_position === "owner" ? "owner_user_id" : "backup_owner_user_id"]:
          input.fromUserId,
      },
      after_state: {
        [item.role_on_position === "owner" ? "owner_user_id" : "backup_owner_user_id"]:
          input.toUserId,
        reason: input.reason,
        applied_at: nowIso,
      },
    });
  }

  if (audits.length) {
    const ins = await admin.from("audit_events").insert(audits);
    if (ins.error) throw new Error(ins.error.message);
  }

  return { moved, skipped: preview.skipped.length };
}

/** Sets owner and/or backup owner on one role, with audit events. */
export async function setPositionOwnership(
  admin: Admin,
  input: {
    positionId: string;
    ownerUserId?: string | null;
    backupOwnerUserId?: string | null;
    actorUserId: string;
    reason: string | null;
  },
): Promise<{ ok: true }> {
  const pos = await admin
    .from("positions")
    .select("id, organization_id, owner_user_id, backup_owner_user_id")
    .eq("id", input.positionId)
    .maybeSingle();
  if (pos.error) throw new Error(pos.error.message);
  if (!pos.data) throw new Error("Position not found");

  const before = pos.data as {
    organization_id: string;
    owner_user_id: string | null;
    backup_owner_user_id: string | null;
  };

  const patch: Record<string, unknown> = {};
  if (input.ownerUserId !== undefined) {
    patch['owner_user_id'] = input.ownerUserId;
    patch['needs_reassignment'] = false;
    patch['reassignment_flagged_at'] = null;
    patch['reassignment_reason'] = null;
  }
  if (input.backupOwnerUserId !== undefined) {
    patch['backup_owner_user_id'] = input.backupOwnerUserId;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  if (
    (input.ownerUserId ?? before.owner_user_id) &&
    (input.ownerUserId ?? before.owner_user_id) ===
      (input.backupOwnerUserId ?? before.backup_owner_user_id)
  ) {
    throw new Error("Owner and backup owner must be different people.");
  }

  const upd = await admin.from("positions").update(patch).eq("id", input.positionId);
  if (upd.error) throw new Error(upd.error.message);

  const audits: Array<Record<string, unknown>> = [];
  if (input.ownerUserId !== undefined) {
    audits.push({
      entity_type: "position",
      entity_id: input.positionId,
      organization_id: before.organization_id,
      action: OWNER_ASSIGN_ACTION,
      actor_user_id: input.actorUserId,
      before_state: { owner_user_id: before.owner_user_id },
      after_state: { owner_user_id: input.ownerUserId, reason: input.reason },
    });
  }
  if (input.backupOwnerUserId !== undefined) {
    audits.push({
      entity_type: "position",
      entity_id: input.positionId,
      organization_id: before.organization_id,
      action: BACKUP_ASSIGN_ACTION,
      actor_user_id: input.actorUserId,
      before_state: { backup_owner_user_id: before.backup_owner_user_id },
      after_state: { backup_owner_user_id: input.backupOwnerUserId, reason: input.reason },
    });
  }
  if (audits.length) {
    const ins = await admin.from("audit_events").insert(audits);
    if (ins.error) throw new Error(ins.error.message);
  }

  return { ok: true };
}
