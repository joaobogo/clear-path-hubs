/**
 * SLA breach escalation.
 *
 * A breach that nobody has acknowledged does not sit silently: once it ages past
 * the elevated threshold we notify the role owner (and platform staff when no
 * owner is set) and record the escalation in audit_events. Escalations are
 * idempotent per breach per calendar day, so a repeated run does not spam.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSlaBreaches, type SlaBreachRow } from "@/lib/admin-sla-breach.server";
import { resolveBreachSeverity, shouldEscalate } from "./breach-severity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;

export const SLA_ESCALATION_ACTION = "sla.breach_escalated";
export const SLA_ESCALATION_ENTITY = "position_commitment";

export type EscalationResult = {
  considered: number;
  escalated: number;
  already_escalated_today: number;
  notified_users: number;
  rows: { id: string; client: string; metric: string; severity: string; notified: boolean }[];
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function escalateSlaBreaches(
  admin: Admin,
  opts: { actorUserId?: string | null; includeTest?: boolean } = {},
): Promise<EscalationResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };
  const today = dayKey(new Date().toISOString());

  const list = await loadSlaBreaches(admin as never, { includeTest: opts.includeTest ?? false });
  const due = list.rows.filter((r) =>
    shouldEscalate({ daysOver: r.days_over, acknowledged: r.acknowledged !== null }),
  );

  const result: EscalationResult = {
    considered: list.rows.length,
    escalated: 0,
    already_escalated_today: 0,
    notified_users: 0,
    rows: [],
  };
  if (due.length === 0) return result;

  // Existing escalations today, keyed commitment:metric.
  const { data: priorRaw } = await a
    .from("audit_events")
    .select("entity_id, after_state, created_at")
    .eq("entity_type", SLA_ESCALATION_ENTITY)
    .eq("action", SLA_ESCALATION_ACTION)
    .gte("created_at", `${today}T00:00:00.000Z`);
  const prior = new Set(
    ((priorRaw ?? []) as Array<Record<string, unknown>>).map((r) => {
      const after = (r['after_state'] ?? {}) as Record<string, unknown>;
      return `${String(r['entity_id'])}:${String(after['metric'] ?? "")}`;
    }),
  );

  for (const row of due) {
    const key = `${row.commitment_id}:${row.metric}`;
    if (prior.has(key)) {
      result.already_escalated_today += 1;
      continue;
    }
    const severity = resolveBreachSeverity({
      daysOver: row.days_over,
      acknowledged: row.acknowledged !== null,
    });
    const notified = await notifyOwner(a, row, severity);
    if (notified) result.notified_users += 1;

    await a.from("audit_events").insert({
      actor_user_id: opts.actorUserId ?? null,
      organization_id: row.organization_id,
      entity_type: SLA_ESCALATION_ENTITY,
      entity_id: row.commitment_id,
      action: SLA_ESCALATION_ACTION,
      after_state: {
        metric: row.metric,
        severity,
        days_over: row.days_over,
        owner_user_id: row.owner_user_id,
        notified,
        position_id: row.position_id,
      },
    });

    result.escalated += 1;
    result.rows.push({
      id: row.id,
      client: row.client_name,
      metric: row.metric_label,
      severity,
      notified,
    });
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyOwner(
  a: { from: (t: string) => any; rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown> },
  row: SlaBreachRow,
  severity: string,
) {
  const title = `${severity === "critical" ? "Critical" : "Ageing"} SLA breach — ${row.client_name}`;
  const body = `${row.metric_label} promised ${row.target_label}, actual ${row.actual_label}. ${row.days_over} day(s) over. No acknowledgement recorded.`;
  const linkPath = "/admin/sla";

  if (row.owner_user_id) {
    const { error } = await a.from("notifications").insert({
      recipient_user_id: row.owner_user_id,
      organization_id: row.organization_id,
      audience: "platform_staff",
      event_type: "approval_needed",
      title,
      body,
      link_path: linkPath,
      entity_type: SLA_ESCALATION_ENTITY,
      entity_id: row.commitment_id,
    });
    if (!error) return true;
  }

  // No owner (or the direct insert failed): page platform staff instead.
  try {
    await a.rpc?.("notify_platform_staff", {
      _organization_id: row.organization_id,
      _event_type: "approval_needed",
      _title: title,
      _body: body,
      _link_path: linkPath,
    });
    return true;
  } catch {
    return false;
  }
}
