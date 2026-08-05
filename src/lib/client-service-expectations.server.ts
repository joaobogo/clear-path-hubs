import {
  type CompletedRoleOutcome,
  type ServiceExpectations,
  type StoredPlan,
  type StoredRoleCommitment,
  buildServiceExpectations,
} from "@/lib/client-service-expectations";

/**
 * Reads the stored plan and role commitments for one organisation and measures
 * performance from completed roles only.
 *
 * Everything returned is traceable to a row: `plan_entitlements` /
 * `subscriptions` for the plan, `position_commitments` for the promises, and
 * `candidate_matches.delivered_at` for what actually happened. Nothing is
 * inferred from pricing copy.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** A role is "completed" once it is filled or closed — no longer in flight. */
const COMPLETED_STATUSES = ["filled", "closed"];

/** Candidates delivered within this window of the first delivery count as the first shortlist. */
const FIRST_SHORTLIST_WINDOW_MS = 24 * 60 * 60 * 1000;

function dayDiff(fromIso: string, toIso: string): number | null {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
  return Math.round((to - from) / 86_400_000);
}

export async function buildServiceExpectationsFor(
  client: AnyClient,
  orgId: string,
): Promise<ServiceExpectations> {
  const [entRes, subRes, commitRes] = await Promise.all([
    client
      .from("plan_entitlements")
      .select("plan_label, roles_total, roles_used, expires_at, source")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("subscriptions")
      .select("plan_label, status, current_period_end")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("position_commitments")
      .select("position_id, first_shortlist_days, shortlist_size, interview_slots_hours, baseline_at")
      .eq("organization_id", orgId),
  ]);

  if (entRes?.error) throw entRes.error;
  if (commitRes?.error) throw commitRes.error;

  const ent = (entRes?.data ?? null) as Row | null;
  const sub = (subRes?.data ?? null) as Row | null;
  const commitRows = (commitRes?.data ?? []) as Row[];

  const plan: StoredPlan | null = ent
    ? {
        label: ent.plan_label ?? null,
        rolesTotal: ent.roles_total ?? null,
        rolesUsed: Number(ent.roles_used ?? 0),
        source: (ent.source as StoredPlan["source"]) ?? null,
        expiresAt: ent.expires_at ?? null,
      }
    : sub && ["active", "trialing", "past_due"].includes(String(sub.status))
      ? {
          label: sub.plan_label ?? null,
          rolesTotal: null,
          rolesUsed: 0,
          source: "subscription",
          expiresAt: sub.current_period_end ?? null,
        }
      : null;

  const commitments: StoredRoleCommitment[] = commitRows.map((r) => ({
    positionId: r.position_id,
    firstShortlistDays: Number(r.first_shortlist_days),
    shortlistSize: Number(r.shortlist_size),
    interviewSlotsHours: Number(r.interview_slots_hours),
  }));

  let completed: CompletedRoleOutcome[] = [];
  const commitIds = commitRows.map((r) => r.position_id).filter(Boolean);

  if (commitIds.length) {
    const { data: posRows, error: posErr } = await client
      .from("positions")
      .select("id, status")
      .eq("organization_id", orgId)
      .in("status", COMPLETED_STATUSES)
      .in("id", commitIds);
    if (posErr) throw posErr;

    const completedIds = ((posRows ?? []) as Row[]).map((p) => p.id);
    if (completedIds.length) {
      const { data: matchRows, error: matchErr } = await client
        .from("candidate_matches")
        .select("position_id, delivered_at")
        .eq("organization_id", orgId)
        .in("position_id", completedIds)
        .not("delivered_at", "is", null);
      if (matchErr) throw matchErr;

      const byPosition = new Map<string, number[]>();
      for (const m of (matchRows ?? []) as Row[]) {
        const at = Date.parse(m.delivered_at);
        if (Number.isNaN(at)) continue;
        const list = byPosition.get(m.position_id) ?? [];
        list.push(at);
        byPosition.set(m.position_id, list);
      }

      completed = completedIds.map((id) => {
        const commit = commitRows.find((c) => c.position_id === id)!;
        const times = (byPosition.get(id) ?? []).sort((a, b) => a - b);
        const first = times[0];
        return {
          positionId: id,
          promisedShortlistDays: Number(commit.first_shortlist_days),
          actualShortlistDays:
            first === undefined ? null : dayDiff(commit.baseline_at, new Date(first).toISOString()),
          promisedShortlistSize: Number(commit.shortlist_size),
          actualShortlistSize:
            first === undefined
              ? null
              : times.filter((t) => t - first <= FIRST_SHORTLIST_WINDOW_MS).length,
        };
      });
    }
  }

  return buildServiceExpectations({ plan, commitments, completed });
}
