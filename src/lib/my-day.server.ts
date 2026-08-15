/**
 * "My day" — the recruiter priority list.
 *
 * This screen introduces no new judgements. It reuses the same loaders that
 * back the shared admin queues (attention, SLA breach, decision backlog) and
 * keeps only the rows attached to positions the signed-in recruiter owns
 * (primary or backup owner). Every row therefore reconciles exactly with the
 * queue it came from; the only difference is the ownership filter and the
 * ordering, which is "most overdue first".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

type Admin = SupabaseClient<never, never, never>;

export type MyDayKind = "sla_breach" | "client_decision" | "position_attention";

export const MY_DAY_KIND_LABEL: Record<MyDayKind, string> = {
  sla_breach: "Commitment missed",
  client_decision: "Waiting on the client",
  position_attention: "Role needs attention",
};

export type MyDayItem = {
  /** Stable per-row id so React keys and dismissal stay predictable. */
  id: string;
  kind: MyDayKind;
  kindLabel: string;
  title: string;
  detail: string;
  /** Whole days past the moment the row became actionable. */
  daysOverdue: number;
  positionId: string;
  positionTitle: string;
  clientName: string;
  /** Where the work is actually done. */
  href: string;
};

export type MyDay = {
  ownerUserId: string;
  ownedPositions: number;
  items: MyDayItem[];
  /** Counts by kind, for the header strip. */
  counts: Record<MyDayKind, number>;
  generated_at: string;
};

export async function loadMyDay(
  admin: Admin,
  opts: { userId: string; includeTest?: boolean },
): Promise<MyDay> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = admin as unknown as { from: (t: string) => any };
  const includeTest = opts.includeTest ?? false;

  let ownedQuery = a
    .from("positions")
    .select("id, title, owner_user_id, backup_owner_user_id, is_test_record")
    .or(
      `owner_user_id.eq.${opts.userId},backup_owner_user_id.eq.${opts.userId}`,
    )
    .limit(500);
  if (!includeTest) ownedQuery = ownedQuery.eq("is_test_record", false);

  const ownedRes = await ownedQuery;
  if (ownedRes.error) throw new Error(ownedRes.error.message);
  const owned = (ownedRes.data ?? []) as Array<Record<string, unknown>>;
  const ownedIds = new Set(owned.map((p) => String(p["id"])));

  const emptyCounts: Record<MyDayKind, number> = {
    sla_breach: 0,
    client_decision: 0,
    position_attention: 0,
  };

  if (ownedIds.size === 0) {
    return {
      ownerUserId: opts.userId,
      ownedPositions: 0,
      items: [],
      counts: emptyCounts,
      generated_at: new Date().toISOString(),
    };
  }

  const [{ loadSlaBreaches }, { loadDecisionBacklog }, { loadAttentionQueue }] =
    await Promise.all([
      import("./admin-sla-breach.server"),
      import("./admin-decision-backlog.server"),
      import("./admin-attention.server"),
    ]);

  const [sla, backlog, attention] = await Promise.all([
    loadSlaBreaches(admin, { includeTest }),
    loadDecisionBacklog(admin, { includeTest }),
    loadAttentionQueue(admin, { includeTest }),
  ]);

  const items: MyDayItem[] = [];

  for (const row of sla.rows) {
    if (!ownedIds.has(row.position_id)) continue;
    if (row.acknowledged) continue;
    items.push({
      id: `sla:${row.id}`,
      kind: "sla_breach",
      kindLabel: MY_DAY_KIND_LABEL.sla_breach,
      title: `${row.metric_label} missed`,
      detail: `${row.target_label} promised · ${row.actual_label} actual`,
      daysOverdue: row.days_over,
      positionId: row.position_id,
      positionTitle: row.position_title,
      clientName: row.client_name,
      href: `/admin/positions/${row.position_id}`,
    });
  }

  for (const row of backlog.rows) {
    if (!ownedIds.has(row.position_id)) continue;
    items.push({
      id: `decision:${row.match_id}`,
      kind: "client_decision",
      kindLabel: MY_DAY_KIND_LABEL.client_decision,
      title: `${row.candidate_name} is waiting on a decision`,
      detail:
        row.last_nudge_at
          ? `Nudged ${new Date(row.last_nudge_at).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE })}`
          : "No nudge sent yet",
      daysOverdue: row.days_waiting,
      positionId: row.position_id,
      positionTitle: row.position_title,
      clientName: row.client_name,
      href: `/admin/candidates/${row.match_id}`,
    });
  }

  for (const row of attention.rows) {
    if (!ownedIds.has(row.position_id)) continue;
    if (row.reasons.length === 0) continue;
    items.push({
      id: `attention:${row.position_id}`,
      kind: "position_attention",
      kindLabel: MY_DAY_KIND_LABEL.position_attention,
      title: row.title,
      detail: `${row.reasons.length} reason${row.reasons.length === 1 ? "" : "s"} · ${row.candidates_sourced} sourced, ${row.submitted_to_client} submitted`,
      daysOverdue: row.days_open,
      positionId: row.position_id,
      positionTitle: row.title,
      clientName: row.organization_name,
      href: `/admin/positions/${row.position_id}`,
    });
  }

  const KIND_WEIGHT: Record<MyDayKind, number> = {
    sla_breach: 0,
    client_decision: 1,
    position_attention: 2,
  };
  items.sort(
    (x, y) =>
      KIND_WEIGHT[x.kind] - KIND_WEIGHT[y.kind] || y.daysOverdue - x.daysOverdue,
  );

  const counts = { ...emptyCounts };
  for (const item of items) counts[item.kind] += 1;

  return {
    ownerUserId: opts.userId,
    ownedPositions: ownedIds.size,
    items,
    counts,
    generated_at: new Date().toISOString(),
  };
}
