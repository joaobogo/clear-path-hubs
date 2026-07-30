/**
 * Reporting against our own SLA: what we promised at role launch, what we
 * actually did, and the gap. Read-only for clients; commitments themselves are
 * written by TaaSFlow staff (RLS enforces this).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addDays, amountLabel, diffDays, worstState, type RoleSla, type SlaMetric } from "@/lib/sla";
import {
  dayMetric,
  emptySummary,
  interviewSlotMetric,
  summarise,
} from "@/lib/sla-report.server";

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

