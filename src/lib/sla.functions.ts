/**
 * Reporting against our own SLA: what we promised at role launch, what we
 * actually did, and the gap. Read-only for clients; commitments themselves are
 * written by TaaSFlow staff (RLS enforces this).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addDays,
  amountLabel,
  diffDays,
  diffHours,
  evaluate,
  varianceLabel,
  worstState,
  type RoleSla,
  type SlaMetric,
  type SlaState,
  type SlaSummary,
} from "@/lib/sla";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export const getSlaPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId?: string }) =>
    z
      .object({ orgId: z.string().uuid(), positionId: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    let commitmentsQuery = supabase
      .from("position_commitments")
      .select(
        "position_id, first_shortlist_days, shortlist_size, interview_slots_hours, baseline_at",
      )
      .eq("organization_id", data.orgId);
    if (data.positionId) commitmentsQuery = commitmentsQuery.eq("position_id", data.positionId);
    const { data: commitments, error } = await commitmentsQuery;
    if (error) throw new Error(error.message);

    const rows = (commitments as AnyRow[]) ?? [];
    if (rows.length === 0) {
      return { roles: [] as RoleSla[], summary: emptySummary() };
    }

    const positionIds = rows.map((r) => r.position_id as string);

    const { data: positions } = await supabase
      .from("positions")
      .select("id, title, status")
      .in("id", positionIds);
    const positionById = new Map<string, AnyRow>(
      ((positions as AnyRow[]) ?? []).map((p) => [p.id, p]),
    );

    const { data: matches } = await supabase
      .from("candidate_matches")
      .select("position_id, delivered_at")
      .eq("organization_id", data.orgId)
      .eq("client_visibility", "visible")
      .in("position_id", positionIds)
      .not("delivered_at", "is", null);
    const deliveriesByPosition = new Map<string, string[]>();
    for (const m of (matches as AnyRow[]) ?? []) {
      const list = deliveriesByPosition.get(m.position_id) ?? [];
      list.push(m.delivered_at as string);
      deliveriesByPosition.set(m.position_id, list);
    }
    for (const list of deliveriesByPosition.values()) list.sort();

    const { data: interviews } = await supabase
      .from("interviews")
      .select("position_id, requested_at, created_at, scheduled_at, proposed_times, updated_at")
      .eq("organization_id", data.orgId)
      .in("position_id", positionIds);
    const interviewsByPosition = new Map<string, AnyRow[]>();
    for (const iv of (interviews as AnyRow[]) ?? []) {
      if (!iv.position_id) continue;
      const list = interviewsByPosition.get(iv.position_id) ?? [];
      list.push(iv);
      interviewsByPosition.set(iv.position_id, list);
    }

    const now = Date.now();
    const roles: RoleSla[] = rows
      .filter((r) => positionById.has(r.position_id))
      .map((r) => {
        const position = positionById.get(r.position_id)!;
        const baselineAt = r.baseline_at as string;
        const deliveries = deliveriesByPosition.get(r.position_id) ?? [];
        const metrics: SlaMetric[] = [];

        // 1 · First candidate in front of you
        const firstDue = addDays(baselineAt, r.first_shortlist_days);
        const firstActual = deliveries[0] ?? null;
        metrics.push(
          dayMetric({
            key: "first_candidate",
            label: "First candidate",
            promise: `Within ${r.first_shortlist_days} days of launch`,
            baselineAt,
            dueAt: firstDue,
            actualAt: firstActual,
            now,
          }),
        );

        // 2 · A full shortlist
        const shortlistDue = addDays(baselineAt, r.first_shortlist_days);
        const shortlistActual = deliveries.length >= r.shortlist_size
          ? deliveries[r.shortlist_size - 1]
          : null;
        metrics.push({
          ...dayMetric({
            key: "full_shortlist",
            label: `Shortlist of ${r.shortlist_size}`,
            promise: `${r.shortlist_size} candidates within ${r.first_shortlist_days} days`,
            baselineAt,
            dueAt: shortlistDue,
            actualAt: shortlistActual,
            now,
          }),
          actual: shortlistActual
            ? amountLabel(diffDays(baselineAt, shortlistActual), "days")
            : `${deliveries.length} of ${r.shortlist_size} so far`,
        });

        // 3 · Interview slots proposed after a request
        const ivs = interviewsByPosition.get(r.position_id) ?? [];
        metrics.push(
          interviewSlotMetric(ivs, r.interview_slots_hours as number, now),
        );

        return {
          positionId: r.position_id as string,
          title: (position.title as string) ?? "Role",
          status: (position.status as string) ?? "active",
          baselineAt,
          metrics,
          state: worstState(metrics.map((m) => m.state)),
        };
      })
      .sort((a, b) => (a.baselineAt < b.baselineAt ? 1 : -1));

    return { roles, summary: summarise(roles) };
  });

function emptySummary(): SlaSummary {
  return { measured: 0, met: 0, onTimeRate: null, averageVarianceDays: null, atRisk: 0 };
}

function dayMetric(args: {
  key: SlaMetric["key"];
  label: string;
  promise: string;
  baselineAt: string;
  dueAt: string;
  actualAt: string | null;
  now: number;
}): SlaMetric {
  const { state, variance } = evaluate(args.dueAt, args.actualAt, args.now);
  const varianceDays = variance === null ? null : variance / (24 * 60 * 60 * 1000);
  return {
    key: args.key,
    label: args.label,
    promise: args.promise,
    dueAt: args.dueAt,
    actualAt: args.actualAt,
    actual: args.actualAt ? amountLabel(diffDays(args.baselineAt, args.actualAt), "days") : "not yet",
    varianceValue: varianceDays,
    varianceUnit: "days",
    variance: varianceLabel(varianceDays, "days"),
    state,
  };
}

/**
 * Average turnaround from an interview request to slots being offered. Only
 * interviews where slots actually went out (or a time was booked) count as
 * measured; the rest are open requests still on our clock.
 */
function interviewSlotMetric(interviews: AnyRow[], hours: number, now: number): SlaMetric {
  const promise = `Interview slots within ${hours}h of a request`;
  const measured: number[] = [];
  const states: SlaState[] = [];
  let lastActualAt: string | null = null;

  for (const iv of interviews) {
    const requestedAt = (iv.requested_at ?? iv.created_at) as string | null;
    if (!requestedAt) continue;
    const hasSlots =
      (Array.isArray(iv.proposed_times) && iv.proposed_times.length > 0) || !!iv.scheduled_at;
    const respondedAt = hasSlots ? ((iv.updated_at ?? iv.scheduled_at) as string | null) : null;
    const dueAt = new Date(new Date(requestedAt).getTime() + hours * 60 * 60 * 1000).toISOString();
    const { state } = evaluate(dueAt, respondedAt, now);
    states.push(state);
    if (respondedAt) {
      measured.push(Math.max(diffHours(requestedAt, respondedAt), 0));
      if (!lastActualAt || respondedAt > lastActualAt) lastActualAt = respondedAt;
    }
  }

  if (states.length === 0) {
    return {
      key: "interview_slots",
      label: "Interview slots",
      promise,
      dueAt: null,
      actualAt: null,
      actual: "no requests yet",
      varianceValue: null,
      varianceUnit: "hours",
      variance: "—",
      state: "pending",
    };
  }

  const avg = measured.length ? measured.reduce((s, v) => s + v, 0) / measured.length : null;
  return {
    key: "interview_slots",
    label: "Interview slots",
    promise,
    dueAt: null,
    actualAt: lastActualAt,
    actual: avg === null ? "waiting on us" : `${amountLabel(avg, "hours")} average`,
    varianceValue: avg === null ? null : avg - hours,
    varianceUnit: "hours",
    variance: avg === null ? "—" : varianceLabel(avg - hours, "hours"),
    state: worstState(states),
  };
}

function summarise(roles: RoleSla[]): SlaSummary {
  let measured = 0;
  let met = 0;
  let atRisk = 0;
  const variances: number[] = [];
  for (const role of roles) {
    for (const m of role.metrics) {
      if (m.state === "met" || m.state === "missed") {
        measured += 1;
        if (m.state === "met") met += 1;
        if (m.varianceUnit === "days" && m.varianceValue !== null) variances.push(m.varianceValue);
      }
      if (m.state === "at_risk" || m.state === "missed") atRisk += 1;
    }
  }
  return {
    measured,
    met,
    onTimeRate: measured ? Math.round((met / measured) * 100) : null,
    averageVarianceDays: variances.length
      ? variances.reduce((s, v) => s + v, 0) / variances.length
      : null,
    atRisk,
  };
}
