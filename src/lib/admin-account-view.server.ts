/**
 * Account-level operating view — server aggregation.
 *
 * Three independent loaders so one failing block never blanks the page. Each
 * one reads the same source rows as the screen it links to:
 *   - commercial  → subscriptions, plan_entitlements, memberships, payments
 *   - delivery    → positions, candidate_matches, decision backlog, SLA breaches
 *   - engagement  → audit_events (client_update.sent), support_sessions
 */
import { computeSeatCount } from "@/lib/client-seats";
import {
  ACCOUNT_OPEN_POSITION_STATUSES,
  ACCOUNT_TERMINAL_MATCH_STAGES,
  type AccountCommercial,
  type AccountDelivery,
  type AccountEngagement,
} from "./admin-account-view";
import { UPDATE_SENT_ACTION, UPDATE_ENTITY } from "./client-update-readiness";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const CLIENT_ROLES = ["client_admin", "client_editor", "client_viewer"] as const;

export async function loadAccountCommercial(
  admin: Any,
  organizationId: string,
): Promise<AccountCommercial> {
  const a = admin as { from: (t: string) => Any };

  const [orgRes, subRes, entRes, seatRes, payRes] = await Promise.all([
    a
      .from("organizations")
      .select("id, plan_name, billing_interval, client_seat_limit")
      .eq("id", organizationId)
      .maybeSingle(),
    a
      .from("subscriptions")
      .select("plan_label, status, current_period_end, cancel_at_period_end, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1),
    a
      .from("plan_entitlements")
      .select("plan_label, roles_total, roles_used, status, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1),
    a
      .from("memberships")
      .select("id, role, status")
      .eq("organization_id", organizationId)
      .in("role", [...CLIENT_ROLES])
      .neq("status", "removed"),
    a
      .from("payments")
      .select("status, amount_cents, currency, paid_at, created_at, position_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  for (const res of [orgRes, subRes, entRes, seatRes, payRes]) {
    if (res?.error) throw new Error(res.error.message);
  }

  const org = (orgRes.data ?? null) as Any;
  const sub = ((subRes.data ?? [])[0] ?? null) as Any;
  const ent = ((entRes.data ?? [])[0] ?? null) as Any;
  const pay = ((payRes.data ?? [])[0] ?? null) as Any;
  const seats = (seatRes.data ?? []) as Array<{ role: string; status: string }>;

  // Shared seat derivation — staff see exactly what the client sees.
  const { seatLimit: seatsLimit, seatsUsed } = computeSeatCount(
    seats,
    org?.client_seat_limit ?? null,
  );

  return {
    organization_id: organizationId,
    plan_label: sub?.plan_label ?? ent?.plan_label ?? org?.plan_name ?? null,
    subscription_status: sub?.status ?? ent?.status ?? null,
    billing_interval: org?.billing_interval ?? null,
    current_period_end: sub?.current_period_end ?? null,
    cancel_at_period_end: sub?.cancel_at_period_end === true,
    roles_total: ent?.roles_total ?? null,
    roles_used: ent?.roles_used ?? null,
    seats_limit: seatsLimit,
    seats_used: seatsUsed,
    seats_remaining: Math.max(0, seatsLimit - seatsUsed),
    last_payment: pay
      ? {
          status: String(pay.status),
          amount_cents: Number(pay.amount_cents ?? 0),
          currency: String(pay.currency ?? "usd"),
          at: String(pay.paid_at ?? pay.created_at),
          position_id: pay.position_id ? String(pay.position_id) : null,
        }
      : null,
    generated_at: new Date().toISOString(),
  };
}

export async function loadAccountDelivery(
  admin: Any,
  organizationId: string,
): Promise<AccountDelivery> {
  const a = admin as { from: (t: string) => Any };

  const posRes = await a
    .from("positions")
    .select("id, status")
    .eq("organization_id", organizationId);
  if (posRes.error) throw new Error(posRes.error.message);
  const positions = (posRes.data ?? []) as Array<{ id: string; status: string }>;
  const openRoles = positions.filter((p) =>
    (ACCOUNT_OPEN_POSITION_STATUSES as readonly string[]).includes(p.status),
  ).length;
  const filledRoles = positions.filter((p) => p.status === "filled").length;

  const matchRes = await a
    .from("candidate_matches")
    .select("id, stage")
    .eq("organization_id", organizationId);
  if (matchRes.error) throw new Error(matchRes.error.message);
  const matches = (matchRes.data ?? []) as Array<{ stage: string }>;
  const inPipeline = matches.filter(
    (m) => !(ACCOUNT_TERMINAL_MATCH_STAGES as readonly string[]).includes(m.stage),
  ).length;

  const [{ loadDecisionBacklog }, { loadSlaBreaches }] = await Promise.all([
    import("./admin-decision-backlog.server"),
    import("./admin-sla-breach.server"),
  ]);
  const [backlog, breaches] = await Promise.all([
    loadDecisionBacklog(admin, { organizationId, includeTest: true }),
    loadSlaBreaches(admin, { includeTest: true }),
  ]);

  return {
    organization_id: organizationId,
    open_roles: openRoles,
    filled_roles: filledRoles,
    candidates_in_pipeline: inPipeline,
    decisions_pending: backlog.rows.length,
    sla_breaches: breaches.rows.filter((r) => r.organization_id === organizationId).length,
    generated_at: new Date().toISOString(),
  };
}

export async function loadAccountEngagement(
  admin: Any,
  organizationId: string,
): Promise<AccountEngagement> {
  const a = admin as { from: (t: string) => Any };

  const [updateRes, supportRes] = await Promise.all([
    a
      .from("audit_events")
      .select("actor_user_id, created_at")
      .eq("entity_type", UPDATE_ENTITY)
      .eq("entity_id", organizationId)
      .eq("action", UPDATE_SENT_ACTION)
      .order("created_at", { ascending: false })
      .limit(1),
    a
      .from("support_sessions")
      .select("id, started_at, ended_at, expires_at")
      .eq("organization_id", organizationId)
      .is("ended_at", null),
  ]);
  for (const res of [updateRes, supportRes]) {
    if (res?.error) throw new Error(res.error.message);
  }

  const lastUpdate = ((updateRes.data ?? [])[0] ?? null) as Any;
  let actorName: string | null = null;
  if (lastUpdate?.actor_user_id) {
    const { data: profile } = await a
      .from("profiles")
      .select("full_name, email")
      .eq("auth_user_id", lastUpdate.actor_user_id)
      .maybeSingle();
    actorName = (profile as Any)?.full_name ?? (profile as Any)?.email ?? null;
  }

  const nowMs = Date.now();
  const open = ((supportRes.data ?? []) as Array<{ started_at: string; expires_at: string | null }>)
    .filter((s) => !s.expires_at || new Date(s.expires_at).getTime() > nowMs)
    .sort((x, y) => new Date(x.started_at).getTime() - new Date(y.started_at).getTime());

  return {
    organization_id: organizationId,
    last_update_sent_at: lastUpdate?.created_at ? String(lastUpdate.created_at) : null,
    last_update_sent_by: actorName,
    open_support_sessions: open.length,
    oldest_open_support_session_at: open[0]?.started_at ?? null,
    generated_at: new Date().toISOString(),
  };
}
