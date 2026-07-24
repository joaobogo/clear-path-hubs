import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Client operational analytics.
 *
 * All metrics are computed from source records (candidate_matches,
 * candidate_stage_history, hire_records, interviews) with tenant filters
 * applied server-side. Small samples return `insufficient_data: true` so the
 * UI can render honest empty states instead of misleading percentages.
 *
 * Definitions live alongside the metric so tooltips reconcile with the query.
 */

const filtersSchema = z.object({
  organization_id: z.string().uuid(),
  from: z.string().datetime().optional(), // ISO
  to: z.string().datetime().optional(),
  position_id: z.string().uuid().optional(),
  status: z.string().optional(), // position status filter
});

export type AnalyticsFilters = z.infer<typeof filtersSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const MIN_SAMPLE = 5;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function hoursBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a) / 3_600_000;
}

export const getClientAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => filtersSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = data.organization_id
      ? { supabase: context.supabase, userId: context.userId }
      : context;

    // Verify caller has access
    const { data: membership } = await supabase
      .from("memberships")
      .select("role, status")
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("Forbidden");

    const fromISO = data.from ?? new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const toISO = data.to ?? new Date().toISOString();

    // Base match query (scope: org + optional position + date window)
    let matchQ = supabase
      .from("candidate_matches")
      .select("id, position_id, stage, created_at, delivered_at, updated_at, client_visibility")
      .eq("organization_id", data.organization_id)
      .gte("created_at", fromISO)
      .lte("created_at", toISO);
    if (data.position_id) matchQ = matchQ.eq("position_id", data.position_id);
    const { data: matches } = await matchQ;
    const matchRows = (matches as Row[]) ?? [];
    const matchIds = matchRows.map((m) => m.id);

    // Stage history for all matches in window
    let history: Row[] = [];
    if (matchIds.length > 0) {
      const { data: h } = await supabase
        .from("candidate_stage_history")
        .select("candidate_match_id, from_stage, to_stage, reason, created_at")
        .in("candidate_match_id", matchIds)
        .order("created_at", { ascending: true });
      history = (h as Row[]) ?? [];
    }

    // Group history by match
    const historyByMatch = new Map<string, Row[]>();
    for (const h of history) {
      const arr = historyByMatch.get(h.candidate_match_id) ?? [];
      arr.push(h);
      historyByMatch.set(h.candidate_match_id, arr);
    }

    // Hire records in window (for rejection reasons + offer/hire counts)
    let hires: Row[] = [];
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hq: any = supabase
        .from("hire_records")
        .select("id, status, close_reason, close_reason_notes, position_id, drafted_at, sent_at, accepted_at, hired_at, closed_at, created_at")
        .eq("organization_id", data.organization_id)
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      if (data.position_id) hq = hq.eq("position_id", data.position_id);
      const { data: hd } = await hq;
      hires = (hd as Row[]) ?? [];
    }

    // Interviews within match set
    let interviews: Row[] = [];
    if (matchIds.length > 0) {
      const { data: iv } = await supabase
        .from("interviews")
        .select("id, candidate_match_id, status, created_at")
        .in("candidate_match_id", matchIds);
      interviews = (iv as Row[]) ?? [];
    }

    // ---- METRICS ----

    // Time to first shortlist (hours) — median across matches that reached shortlisted
    const shortlistTimes: number[] = [];
    for (const m of matchRows) {
      const events = historyByMatch.get(m.id) ?? [];
      const shortEvt = events.find((e) => e.to_stage === "shortlisted");
      if (shortEvt) {
        const h = hoursBetween(m.created_at, shortEvt.created_at);
        if (h !== null && h >= 0) shortlistTimes.push(h);
      }
    }
    const timeToFirstShortlist = {
      definition:
        "Median hours between candidate creation and reaching the shortlisted stage in this window.",
      median_hours: median(shortlistTimes),
      sample_size: shortlistTimes.length,
      insufficient_data: shortlistTimes.length < MIN_SAMPLE,
    };

    // Time between deliveries (hours) — grouped by position, then median of intra-position gaps
    const byPosDeliveries = new Map<string, number[]>();
    for (const m of matchRows) {
      if (!m.delivered_at) continue;
      const arr = byPosDeliveries.get(m.position_id) ?? [];
      arr.push(new Date(m.delivered_at).getTime());
      byPosDeliveries.set(m.position_id, arr);
    }
    const gapHours: number[] = [];
    for (const times of byPosDeliveries.values()) {
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        gapHours.push((times[i] - times[i - 1]) / 3_600_000);
      }
    }
    const timeBetweenDeliveries = {
      definition:
        "Median hours between consecutive candidate deliveries within the same position.",
      median_hours: median(gapHours),
      sample_size: gapHours.length,
      insufficient_data: gapHours.length < MIN_SAMPLE,
    };

    // Candidates delivered per role/week
    const deliveredCount = matchRows.filter((m) => m.delivered_at).length;
    const days = Math.max(1, (new Date(toISO).getTime() - new Date(fromISO).getTime()) / (24 * 3600 * 1000));
    const weeks = days / 7;
    const deliveredPerWeek = deliveredCount / weeks;

    // Client review time — median hours from delivered_at to first stage transition after delivery
    const reviewTimes: number[] = [];
    for (const m of matchRows) {
      if (!m.delivered_at) continue;
      const events = historyByMatch.get(m.id) ?? [];
      const first = events.find(
        (e) => new Date(e.created_at).getTime() > new Date(m.delivered_at).getTime() && e.to_stage !== "delivered",
      );
      if (first) {
        const h = hoursBetween(m.delivered_at, first.created_at);
        if (h !== null && h >= 0) reviewTimes.push(h);
      }
    }
    const clientReviewTime = {
      definition:
        "Median hours between delivery and the client's first stage action on that candidate.",
      median_hours: median(reviewTimes),
      sample_size: reviewTimes.length,
      insufficient_data: reviewTimes.length < MIN_SAMPLE,
    };

    // Stage conversion + funnel counts
    const stageCounts: Record<string, number> = {
      delivered: 0,
      shortlisted: 0,
      interview_process: 0,
      offer: 0,
      hired: 0,
      not_moving_forward: 0,
    };
    const reachedStage = new Map<string, Set<string>>();
    for (const key of Object.keys(stageCounts)) reachedStage.set(key, new Set());
    for (const m of matchRows) {
      const events = historyByMatch.get(m.id) ?? [];
      const stages = new Set<string>([m.stage, ...events.map((e) => e.to_stage)].filter(Boolean) as string[]);
      for (const s of stages) {
        if (reachedStage.has(s)) reachedStage.get(s)!.add(m.id);
      }
    }
    for (const [k, set] of reachedStage) stageCounts[k] = set.size;

    const rate = (num: number, den: number): { value: number | null; insufficient_data: boolean } => {
      if (den < MIN_SAMPLE) return { value: null, insufficient_data: true };
      return { value: num / den, insufficient_data: false };
    };
    const interviewRate = rate(stageCounts.interview_process, stageCounts.shortlisted);
    const offerRate = rate(stageCounts.offer, stageCounts.interview_process);
    const hireRate = rate(stageCounts.hired, stageCounts.offer);

    // Stage aging — for candidates currently in each stage, median hours since last transition
    const openStages = ["reviewing", "delivered", "shortlisted", "interview_process", "offer"] as const;
    const stageAging: Array<{ stage: string; median_hours: number | null; count: number }> = [];
    for (const stage of openStages) {
      const inStage = matchRows.filter((m) => m.stage === stage);
      const ages = inStage
        .map((m) => {
          const events = (historyByMatch.get(m.id) ?? []).filter((e) => e.to_stage === stage);
          const anchor = events[events.length - 1]?.created_at ?? m.updated_at ?? m.created_at;
          return hoursBetween(anchor, new Date().toISOString());
        })
        .filter((v): v is number => v !== null);
      stageAging.push({ stage, median_hours: median(ages), count: inStage.length });
    }

    // Rejection reasons — from hire_records.close_reason
    const rejectionMap = new Map<string, number>();
    for (const h of hires) {
      if (h.close_reason) rejectionMap.set(h.close_reason, (rejectionMap.get(h.close_reason) ?? 0) + 1);
    }
    // Also mine stage_history where to_stage='not_moving_forward' for text reasons
    const stageReasonMap = new Map<string, number>();
    for (const h of history) {
      if (h.to_stage === "not_moving_forward" && h.reason) {
        const key = String(h.reason).trim().toLowerCase();
        if (key) stageReasonMap.set(key, (stageReasonMap.get(key) ?? 0) + 1);
      }
    }
    const rejectionReasons = {
      definition:
        "Rejection reasons drawn from formal offer close reasons and pipeline stage moves to 'not moving forward' in this window.",
      offer_close: Array.from(rejectionMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      stage_moves: Array.from(stageReasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
    };

    // Interview counts
    const interviewCount = interviews.length;

    return {
      filters: { from: fromISO, to: toISO, position_id: data.position_id ?? null },
      totals: {
        matches: matchRows.length,
        delivered: deliveredCount,
        interviews: interviewCount,
        hires: hires.filter((h) => h.status === "hire_confirmed").length,
        offers_sent: hires.filter((h) => h.status !== "offer_drafted").length,
      },
      timing: {
        time_to_first_shortlist: timeToFirstShortlist,
        time_between_deliveries: timeBetweenDeliveries,
        client_review_time: clientReviewTime,
        delivered_per_week: {
          definition: "Total candidates with a non-null delivered_at, divided by weeks in the window.",
          value: deliveredPerWeek,
          sample_size: deliveredCount,
          insufficient_data: deliveredCount < MIN_SAMPLE,
        },
      },
      funnel: {
        definition: "Distinct candidate count that reached each stage during the window.",
        counts: stageCounts,
      },
      conversion: {
        definition:
          "Stage-to-stage rate uses the earlier stage as denominator. Rates below 5 sample size return no value.",
        interview_rate: interviewRate,
        offer_rate: offerRate,
        hire_rate: hireRate,
      },
      stage_aging: {
        definition: "For candidates currently in the stage, median hours since they entered it.",
        rows: stageAging,
      },
      rejection_reasons: rejectionReasons,
    };
  });

// Available positions for filter dropdown
export const getAnalyticsFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ organization_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: pos } = await context.supabase
      .from("positions")
      .select("id, title, status")
      .eq("organization_id", data.organization_id)
      .order("title");
    return { positions: (pos as Row[]) ?? [] };
  });
