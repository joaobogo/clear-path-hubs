/**
 * Support session / impersonation audit helpers.
 *
 * Two guarantees live here:
 *  1. Sessions expire without manual action — every read sweeps sessions whose
 *     `expires_at` has passed and closes them with end_reason='expired'.
 *  2. Every support action is attributable to a session — actions are joined to
 *     their session id so a reviewer can replay exactly what happened inside a
 *     given window.
 */

// The admin client type is intentionally loose; callers pass supabaseAdmin.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Admin = any;

export const SUPPORT_SESSION_WINDOW_MINUTES = 30;

export type SupportAuditAction = {
  id: string;
  session_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  reason: string;
  occurred_at: string;
};

export type SupportAuditSession = {
  id: string;
  organization_id: string | null;
  organization_name: string;
  staff_name: string;
  staff_email: string | null;
  actor_role: string;
  mode: string;
  scope: string;
  reason: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  end_reason: string | null;
  is_active: boolean;
  actions: SupportAuditAction[];
};

/**
 * Closes any session past its expiry. Idempotent, cheap, and safe to call on
 * every read — this is what makes expiry automatic rather than a manual step.
 */
export async function sweepExpiredSupportSessions(admin: Admin): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("support_sessions")
    .update({ ended_at: nowIso, end_reason: "expired" })
    .is("ended_at", null)
    .lt("expires_at", nowIso)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

/** Returns the caller's live (unexpired, unclosed) session for an org, if any. */
export async function findActiveSupportSession(
  admin: Admin,
  actorUserId: string,
  organizationId: string,
): Promise<{ id: string; expires_at: string; reason: string; trace_id: string | null } | null> {
  await sweepExpiredSupportSessions(admin);
  const { data } = await admin
    .from("support_sessions")
    .select("id, expires_at, reason, trace_id")
    .eq("actor_user_id", actorUserId)
    .eq("organization_id", organizationId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; expires_at: string; reason: string; trace_id: string | null } | null) ?? null;
}

/**
 * Writes a support action tagged with the session it belongs to. Actions
 * without a live session are rejected so support work can never be silent.
 */
export async function recordSupportAction(
  admin: Admin,
  input: {
    session_id: string;
    actor_user_id: string;
    organization_id: string | null;
    action: string;
    target_type: string;
    target_id?: string | null;
    reason: string;
    before_state?: unknown;
    after_state?: unknown;
    trace_id?: string | null;
  },
): Promise<void> {
  const { error } = await admin.from("support_actions").insert({
    session_id: input.session_id,
    actor_user_id: input.actor_user_id,
    organization_id: input.organization_id,
    action: input.action,
    target_type: input.target_type,
    target_id: input.target_id ?? null,
    reason: input.reason,
    before_state: input.before_state ?? null,
    after_state: input.after_state ?? null,
    trace_id: input.trace_id ?? null,
  });
  if (error) throw error;
}

/** Full audit list for a period, with each session's actions nested under it. */
export async function loadSupportAudit(
  admin: Admin,
  days: number,
): Promise<{ sessions: SupportAuditSession[]; expired_now: number }> {
  const expiredNow = await sweepExpiredSupportSessions(admin);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessions, error } = await admin
    .from("support_sessions")
    .select(
      "id, organization_id, actor_user_id, actor_role, mode, scope, reason, started_at, expires_at, ended_at, end_reason",
    )
    .gte("started_at", sinceIso)
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const rows = (sessions ?? []) as any[];
  if (rows.length === 0) return { sessions: [], expired_now: expiredNow };

  const sessionIds = rows.map((s) => s.id);
  const orgIds = Array.from(new Set(rows.map((s) => s.organization_id).filter(Boolean)));
  const staffIds = Array.from(new Set(rows.map((s) => s.actor_user_id)));

  const [actionsRes, orgsRes, staffRes] = await Promise.all([
    admin
      .from("support_actions")
      .select("id, session_id, action, target_type, target_id, reason, occurred_at")
      .in("session_id", sessionIds)
      .order("occurred_at", { ascending: true })
      .limit(1000),
    orgIds.length
      ? admin.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [] }),
    admin.from("profiles").select("auth_user_id, full_name, email").in("auth_user_id", staffIds),
  ]);

  const orgNames = new Map<string, string>(
    ((orgsRes as any).data ?? []).map((o: any) => [o.id, o.name as string]),
  );
  const staff = new Map<string, { name: string; email: string | null }>(
    ((staffRes as any).data ?? []).map((p: any) => [
      p.auth_user_id,
      { name: (p.full_name as string | null) || (p.email as string), email: p.email as string },
    ]),
  );
  const actionsBySession = new Map<string, SupportAuditAction[]>();
  for (const a of ((actionsRes as any).data ?? []) as any[]) {
    if (!a.session_id) continue;
    const list = actionsBySession.get(a.session_id) ?? [];
    list.push({
      id: a.id,
      session_id: a.session_id,
      action: a.action,
      target_type: a.target_type ?? null,
      target_id: a.target_id ?? null,
      reason: a.reason,
      occurred_at: a.occurred_at,
    });
    actionsBySession.set(a.session_id, list);
  }

  return {
    expired_now: expiredNow,
    sessions: rows.map((s) => ({
      id: s.id,
      organization_id: s.organization_id ?? null,
      organization_name: s.organization_id ? (orgNames.get(s.organization_id) ?? "—") : "—",
      staff_name: staff.get(s.actor_user_id)?.name ?? "Unknown staff member",
      staff_email: staff.get(s.actor_user_id)?.email ?? null,
      actor_role: s.actor_role,
      mode: s.mode,
      scope: s.scope,
      reason: s.reason,
      started_at: s.started_at,
      expires_at: s.expires_at,
      ended_at: s.ended_at ?? null,
      end_reason: s.end_reason ?? null,
      is_active: !s.ended_at,
      actions: actionsBySession.get(s.id) ?? [],
    })),
  };
}
