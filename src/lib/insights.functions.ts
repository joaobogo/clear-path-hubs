import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeCost,
  computeDropout,
  computeSpeed,
  makeWindow,
  type CommitmentRecord,
  type DeliveryRecord,
  type HireRecord,
  type MatchRecord,
  type SpendRecord,
  type StageEvent,
} from "@/lib/insights-metrics";

/**
 * Three answerable questions, computed from real records only:
 *   1. Where do candidates drop out?
 *   2. How fast are we vs. our promise?
 *   3. What did we spend per hire?
 *
 * Nothing is modelled, estimated or benchmarked. When the records needed for
 * an answer do not exist, the metric returns `available: false` with a reason
 * so the UI can say so plainly instead of drawing a misleading chart. The
 * arithmetic lives in `insights-metrics.ts` and is unit-tested there.
 */

export type { FunnelStep, SpeedRow } from "@/lib/insights-metrics";

const inputSchema = z.object({
  organization_id: z.string().uuid(),
  days: z.number().int().min(7).max(365).default(90),
  position_id: z.string().uuid().optional(),
});

export const getClientInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => inputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("memberships")
      .select("role, status")
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("Forbidden");

    const w = makeWindow(data.days);

    // ── Records ──────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchQ: any = supabase
      .from("candidate_matches")
      .select("id, position_id, stage, created_at, delivered_at")
      .eq("organization_id", data.organization_id)
      .not("delivered_at", "is", null)
      .gte("delivered_at", w.fromISO)
      .lte("delivered_at", w.toISO);
    if (data.position_id) matchQ = matchQ.eq("position_id", data.position_id);
    const matches = (((await matchQ).data as MatchRecord[]) ?? []);
    const matchIds = matches.map((m) => m.id);

    let history: StageEvent[] = [];
    if (matchIds.length) {
      const { data: h } = await supabase
        .from("candidate_stage_history")
        .select("candidate_match_id, to_stage, created_at")
        .in("candidate_match_id", matchIds);
      history = (h as StageEvent[]) ?? [];
    }

    let commitQ = supabase
      .from("position_commitments")
      .select("position_id, first_shortlist_days, shortlist_size, baseline_at")
      .eq("organization_id", data.organization_id);
    if (data.position_id) commitQ = commitQ.eq("position_id", data.position_id);
    const commitments = ((await commitQ).data as CommitmentRecord[]) ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dq: any = supabase
      .from("candidate_matches")
      .select("position_id, delivered_at")
      .eq("organization_id", data.organization_id)
      .eq("client_visibility", "visible")
      .not("delivered_at", "is", null);
    if (data.position_id) dq = dq.eq("position_id", data.position_id);
    const deliveries = ((await dq).data as DeliveryRecord[]) ?? [];

    const { data: spendRows } = await supabase
      .from("recruiting_spend_entries")
      .select("amount, currency, category, period_start, period_end")
      .eq("organization_id", data.organization_id)
      .gte("period_end", w.fromISO.slice(0, 10))
      .lte("period_start", w.toISO.slice(0, 10));
    const spendList = (spendRows as SpendRecord[]) ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hireQ: any = supabase
      .from("hire_records")
      .select("id, position_id, hired_at, salary_amount, salary_currency")
      .eq("organization_id", data.organization_id)
      .eq("status", "hire_confirmed")
      .not("hired_at", "is", null)
      .gte("hired_at", w.fromISO)
      .lte("hired_at", w.toISO);
    if (data.position_id) hireQ = hireQ.eq("position_id", data.position_id);
    const hires = ((await hireQ).data as HireRecord[]) ?? [];

    return {
      window: { from: w.fromISO, to: w.toISO, days: data.days },
      dropout: computeDropout(matches, history, w),
      speed: computeSpeed(commitments, deliveries),
      cost: computeCost(spendList, hires, w),
    };
  });

export const getInsightsPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ organization_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase
      .from("memberships")
      .select("id")
      .eq("user_id", context.userId)
      .eq("organization_id", data.organization_id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("Forbidden");

    const { data: pos } = await context.supabase
      .from("positions")
      .select("id, title")
      .eq("organization_id", data.organization_id)
      .order("title");
    return {
      positions: ((pos as { id: string; title: string }[]) ?? []).map((p) => ({ id: p.id, title: p.title })),
    };
  });
