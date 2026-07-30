import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Three answerable questions, computed from real records only:
 *   1. Where do candidates drop out?
 *   2. How fast are we vs. our promise?
 *   3. What did we spend per hire?
 *
 * Nothing is modelled, estimated or benchmarked. When the records needed for
 * an answer do not exist, the metric returns `available: false` with a reason
 * so the UI can say so plainly instead of drawing a misleading chart.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const DAY_MS = 24 * 3600 * 1000;

const inputSchema = z.object({
  organization_id: z.string().uuid(),
  days: z.number().int().min(7).max(365).default(90),
  position_id: z.string().uuid().optional(),
});

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  /** Candidates who reached the previous step but never this one. */
  dropped: number;
  /** Share of the previous step that continued, null when no previous step. */
  continued_rate: number | null;
};

export type SpeedRow = {
  key: string;
  label: string;
  promise_days: number;
  actual_days: number | null;
  variance_days: number | null;
  measured: number;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const STEPS: { key: string; label: string }[] = [
  { key: "delivered", label: "Shown to you" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview_process", label: "Interviewed" },
  { key: "offer", label: "Offered" },
  { key: "hired", label: "Hired" },
];

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

    const toISO = new Date().toISOString();
    const fromISO = new Date(Date.now() - data.days * DAY_MS).toISOString();

    // ── Records ──────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchQ: any = supabase
      .from("candidate_matches")
      .select("id, position_id, stage, created_at, delivered_at")
      .eq("organization_id", data.organization_id)
      .not("delivered_at", "is", null)
      .gte("delivered_at", fromISO)
      .lte("delivered_at", toISO);
    if (data.position_id) matchQ = matchQ.eq("position_id", data.position_id);
    const matches = ((await matchQ).data as Row[]) ?? [];
    const matchIds = matches.map((m) => m.id);

    let history: Row[] = [];
    if (matchIds.length) {
      const { data: h } = await supabase
        .from("candidate_stage_history")
        .select("candidate_match_id, to_stage, created_at")
        .in("candidate_match_id", matchIds);
      history = (h as Row[]) ?? [];
    }

    // ── 1 · Where do candidates drop out? ────────────────────────────────
    const reached = new Map<string, Set<string>>(STEPS.map((s) => [s.key, new Set<string>()]));
    for (const m of matches) {
      const stages = new Set<string>([
        "delivered",
        m.stage,
        ...history.filter((h) => h.candidate_match_id === m.id).map((h) => h.to_stage),
      ].filter(Boolean) as string[]);
      for (const s of stages) reached.get(s)?.add(m.id);
    }
    const funnel: FunnelStep[] = STEPS.map((s, i) => {
      const count = reached.get(s.key)!.size;
      const prev = i === 0 ? null : reached.get(STEPS[i - 1].key)!.size;
      return {
        key: s.key,
        label: s.label,
        count,
        dropped: prev === null ? 0 : Math.max(0, prev - count),
        continued_rate: prev && prev > 0 ? count / prev : null,
      };
    });
    const biggestDrop = funnel
      .slice(1)
      .reduce<FunnelStep | null>((worst, s) => (!worst || s.dropped > worst.dropped ? s : worst), null);
    const dropout = {
      available: matches.length > 0,
      reason: matches.length === 0 ? "No candidates have been shown to you in this window yet." : null,
      steps: funnel,
      total: matches.length,
      biggest_drop: biggestDrop && biggestDrop.dropped > 0
        ? { label: biggestDrop.label, from: STEPS[STEPS.findIndex((s) => s.key === biggestDrop.key) - 1].label, dropped: biggestDrop.dropped }
        : null,
    };

    // ── 2 · How fast are we vs. our promise? ─────────────────────────────
    let commitQ = supabase
      .from("position_commitments")
      .select("position_id, first_shortlist_days, shortlist_size, baseline_at")
      .eq("organization_id", data.organization_id);
    if (data.position_id) commitQ = commitQ.eq("position_id", data.position_id);
    const commitments = ((await commitQ).data as Row[]) ?? [];

    const deliveriesByPosition = new Map<string, number[]>();
    {
      // Deliveries are measured from role launch, so read them unbounded by window.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let dq: any = supabase
        .from("candidate_matches")
        .select("position_id, delivered_at")
        .eq("organization_id", data.organization_id)
        .eq("client_visibility", "visible")
        .not("delivered_at", "is", null);
      if (data.position_id) dq = dq.eq("position_id", data.position_id);
      for (const m of ((await dq).data as Row[]) ?? []) {
        const list = deliveriesByPosition.get(m.position_id) ?? [];
        list.push(new Date(m.delivered_at).getTime());
        deliveriesByPosition.set(m.position_id, list);
      }
      for (const list of deliveriesByPosition.values()) list.sort((a, b) => a - b);
    }

    const firstPromise: number[] = [];
    const firstActual: number[] = [];
    const shortlistPromise: number[] = [];
    const shortlistActual: number[] = [];
    for (const c of commitments) {
      const base = new Date(c.baseline_at).getTime();
      const times = deliveriesByPosition.get(c.position_id) ?? [];
      if (times[0]) {
        firstPromise.push(c.first_shortlist_days);
        firstActual.push((times[0] - base) / DAY_MS);
      }
      if (times.length >= c.shortlist_size) {
        shortlistPromise.push(c.first_shortlist_days);
        shortlistActual.push((times[c.shortlist_size - 1] - base) / DAY_MS);
      }
    }
    const speedRows: SpeedRow[] = [
      {
        key: "first_candidate",
        label: "First candidate",
        promise_days: median(firstPromise) ?? 0,
        actual_days: median(firstActual),
        variance_days:
          median(firstActual) !== null && median(firstPromise) !== null
            ? (median(firstActual) as number) - (median(firstPromise) as number)
            : null,
        measured: firstActual.length,
      },
      {
        key: "full_shortlist",
        label: "Full shortlist",
        promise_days: median(shortlistPromise) ?? 0,
        actual_days: median(shortlistActual),
        variance_days:
          median(shortlistActual) !== null && median(shortlistPromise) !== null
            ? (median(shortlistActual) as number) - (median(shortlistPromise) as number)
            : null,
        measured: shortlistActual.length,
      },
    ].filter((r) => r.measured > 0);

    const speed = {
      available: speedRows.length > 0,
      reason:
        commitments.length === 0
          ? "No service commitments have been set on your roles yet."
          : speedRows.length === 0
            ? "No commitment has run its course yet — nothing measurable so far."
            : null,
      rows: speedRows,
      roles_measured: commitments.length,
    };

    // ── 3 · What did we spend per hire? ──────────────────────────────────
    const { data: spendRows } = await supabase
      .from("recruiting_spend_entries")
      .select("amount, currency, category, period_start, period_end")
      .eq("organization_id", data.organization_id)
      .gte("period_end", fromISO.slice(0, 10))
      .lte("period_start", toISO.slice(0, 10));
    const spendList = (spendRows as Row[]) ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hireQ: any = supabase
      .from("hire_records")
      .select("id, position_id, hired_at, salary_amount, salary_currency")
      .eq("organization_id", data.organization_id)
      .eq("status", "hire_confirmed")
      .not("hired_at", "is", null)
      .gte("hired_at", fromISO)
      .lte("hired_at", toISO);
    if (data.position_id) hireQ = hireQ.eq("position_id", data.position_id);
    const hires = ((await hireQ).data as Row[]) ?? [];

    const currency = spendList[0]?.currency ?? "EUR";
    const mixedCurrency = spendList.some((s) => s.currency !== currency);
    const totalSpend = spendList.reduce((sum, s) => sum + Number(s.amount ?? 0), 0);
    const byCategory = new Map<string, number>();
    for (const s of spendList) {
      byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + Number(s.amount ?? 0));
    }

    const cost = {
      available: spendList.length > 0 && hires.length > 0 && !mixedCurrency,
      reason:
        spendList.length === 0
          ? "No recruiting spend has been recorded for this workspace, so cost per hire cannot be calculated."
          : hires.length === 0
            ? "No confirmed hire in this window yet — cost per hire needs at least one."
            : mixedCurrency
              ? "Spend is recorded in more than one currency. We don't convert, so no single figure is shown."
              : null,
      currency,
      total_spend: totalSpend,
      hires: hires.length,
      cost_per_hire: hires.length > 0 ? totalSpend / hires.length : null,
      by_category: Array.from(byCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      entries_counted: spendList.length,
    };

    return {
      window: { from: fromISO, to: toISO, days: data.days },
      dropout,
      speed,
      cost,
    };
  });

export const getInsightsPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ organization_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: pos } = await context.supabase
      .from("positions")
      .select("id, title")
      .eq("organization_id", data.organization_id)
      .order("title");
    return { positions: ((pos as Row[]) ?? []).map((p) => ({ id: p.id, title: p.title })) };
  });
