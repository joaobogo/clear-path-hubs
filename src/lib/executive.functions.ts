// Executive Portfolio View — leadership-layer aggregations for enterprise clients.
//
// All reads are scoped to a single organization and go through the authenticated
// Supabase client so RLS applies as the caller. Staff can pass any org they have
// visibility into via the standard client-context path.

import { formatShortDayMonth } from "@/lib/format/datetime";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isLiveOffer, qualifiesAsHire } from "@/lib/offer-hire";
import { loadConfirmedHires } from "@/lib/kpis/confirmed-hires.server";
import { loadOpenRoles, loadOrgRoles } from "@/lib/kpis/open-roles.server";
import { loadKpiRows, computeKpis, isAwaitingClientDecision } from "@/lib/client-kpi.server";
import { NOT_TEST_RECORD } from "@/lib/client/test-record-filter";
import {
  PUBLISHED_SCORE_COLUMNS,
  publishedScore,
  type PublishedScoreRun,
} from "@/lib/scoring/published-score";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const inputSchema = z.object({
  organization_id: z.string().uuid(),
});

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeRegion(location: string | null | undefined): string {
  if (!location) return "Unspecified";
  // Take the last comma-separated segment as the region proxy (city, region, country → region).
  const parts = String(location)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? "Unspecified";
}

function isoWeekStart(d: Date): Date {
  const day = d.getUTCDay();
  const daysFromMon = (day + 6) % 7;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      daysFromMon * 86_400_000,
  );
}

function weekLabel(d: Date): string {
  // "29 Jun" — the short form of the one workspace date format. Never "06/29":
  // a slashed numeric pair reads as an American month/day to half the readers.
  return formatShortDayMonth(d);
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ExecutiveReport = {
  organization_id: string;
  generated_at: string;
  open_by_region: Array<{ region: string; open: number; filled: number; total: number }>;
  pipeline_by_bu: Array<{
    business_unit: string;
    open_roles: number;
    active_candidates: number;
    delivered: number;
    shortlisted: number;
    hired: number;
    /** Delivered candidates with no client decision recorded yet. */
    awaiting_decision: number;
    blocked: number;
  }>;
  /** p90 is null under five candidates, where it only repeats the average. */
  time_in_stage: Array<{ stage: string; count: number; avg_days: number; p90_days: number | null }>;

  bottlenecks: Array<{
    key: string;
    label: string;
    count: number;
    severity: "info" | "warn" | "crit";
    hint: string;
  }>;
  delivery_velocity: Array<{ week_start: string; label: string; delivered: number }>;
  shortlist_quality: Array<{ week_start: string; label: string; avg_score: number | null; count: number }>;
  finance_summary: {
    hires_30d: number;
    hires_90d: number;
    hires_ytd: number;
    open_offers: number;
    /** MAJOR units (whole euros/dollars), as stored in hire_records. */
    open_offer_value: number | null;
    /** How many of the open offers actually have compensation recorded. */
    open_offers_with_compensation: number;
    /** MAJOR units. Mean across OPEN offers with compensation only. */
    avg_salary: number | null;
    salary_currency: string | null;

    projected_hires_next_30d: number;
  };
};

// ── Handler ────────────────────────────────────────────────────────────────

export const getExecutiveReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => inputSchema.parse(raw))
  .handler(async ({ data, context }): Promise<ExecutiveReport> => {
    const s = context.supabase as AnyRow;
    const orgId = data.organization_id;

    const now = new Date();
    const iso = (d: Date) => d.toISOString();
    const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    // ── Positions (open by region + pipeline by BU counts) ────────────────
    const { data: positions } = await s
      .from("positions")
      .select("id, department, location, status, title, is_test_record")
      .eq("organization_id", orgId)
      .or(NOT_TEST_RECORD);
    const posRows: AnyRow[] = positions ?? [];


    // ── Matches (pipeline by BU, time-in-stage, blocked) ──────────────────
    const { data: matches } = await s
      .from("candidate_matches")
      .select(
        "id, position_id, stage, admin_status, client_visibility, delivered_at, updated_at, processing_state, approved_score_run_id",
      )
      .eq("organization_id", orgId)
      .or(NOT_TEST_RECORD);
    const matchRows: AnyRow[] = matches ?? [];
    const posById = new Map<string, AnyRow>(posRows.map((p) => [p.id, p]));

    // Open / filled by region. Both Insights panels read the same open-roles
    // rule as the Roles page (selectOpenClientRoles), so a role with an active
    // search and a live offer is never reported as filled.
    // Roles come from the one reader; the local rows carry the extra columns
    // Insights needs (location), so they are narrowed by the reader's ids.
    const accountRoleIds = new Set<string>(
      (await loadOrgRoles(s, orgId)).map((p: AnyRow) => String(p.id)),
    );
    const clientPositions = posRows.filter((p: AnyRow) =>
      accountRoleIds.has(String(p.id)),
    );
    const openPositionIds = new Set<string>(
      (await loadOpenRoles(s, orgId)).map((p: AnyRow) => String(p.id)),
    );

    const regionMap = new Map<string, { open: number; filled: number; total: number }>();
    for (const p of clientPositions) {
      const region = normalizeRegion(p.location);
      const bucket = regionMap.get(region) ?? { open: 0, filled: 0, total: 0 };

      const isOpen = openPositionIds.has(String(p.id));
      const isFilled = !isOpen && String(p.status) === "filled";

      bucket.total += 1;
      if (isOpen) bucket.open += 1;
      if (isFilled) bucket.filled += 1;

      regionMap.set(region, bucket);
    }
    const open_by_region = Array.from(regionMap.entries())
      .map(([region, v]) => ({ region, ...v }))
      .sort((a, b) => b.open - a.open || b.total - a.total);

    // Pipeline by business unit (department).
    //
    // Hires and "needs your input" come from the same rows the Overview tiles
    // and the client board read, so a team row can never claim a hire the
    // Overview does not, or show nothing to decide while the board shows ten.
    const kpiRows = await loadKpiRows(s, orgId);
    const hiredMatchIds = new Set(
      kpiRows.filter((r) => r.hire_confirmed).map((r) => String(r.id)),
    );
    const awaitingDecisionMatchIds = new Set(
      kpiRows.filter(isAwaitingClientDecision).map((r) => String(r.id)),
    );
    const buMap = new Map<
      string,
      {
        open_roles: Set<string>;
        active_candidates: number;
        delivered: number;
        shortlisted: number;
        hired: number;
        awaiting_decision: number;
        blocked: number;
      }
    >();
    const ensureBu = (bu: string) => {
      let v = buMap.get(bu);
      if (!v) {
        v = {
          open_roles: new Set<string>(),
          active_candidates: 0,
          delivered: 0,
          shortlisted: 0,
          hired: 0,
          awaiting_decision: 0,
          blocked: 0,
        };
        buMap.set(bu, v);
      }
      return v;
    };
    for (const p of clientPositions) {
      const bu = (p.department as string | null)?.trim() || "Unassigned";
      const v = ensureBu(bu);
      if (openPositionIds.has(String(p.id))) v.open_roles.add(String(p.id));
    }
    for (const m of matchRows) {
      const p = posById.get(m.position_id);
      const bu = ((p?.department as string | null) ?? "").trim() || "Unassigned";
      const v = ensureBu(bu);
      const stage = String(m.stage ?? "");
      
      // P16: Active means candidate is delivered but not yet hired, rejected or withdrawn.
      // We must not double-count by summing stages.
      const isDelivered = !!m.delivered_at;
      // One definition of a hire: a confirmed offer record, never the stage.
      const isHired = hiredMatchIds.has(String(m.id));
      const isTerminal = ["rejected", "withdrawn", "not_moving_forward"].includes(stage);
      const isActive = isDelivered && !isHired && !isTerminal;

      if (isActive) v.active_candidates += 1;
      if (isDelivered) v.delivered += 1;
      if (stage === "shortlisted") v.shortlisted += 1;
      if (isHired) v.hired += 1;
      if (awaitingDecisionMatchIds.has(String(m.id))) v.awaiting_decision += 1;
      if (["failed", "error"].includes(String(m.processing_state ?? ""))) v.blocked += 1;
    }
    const pipeline_by_bu = Array.from(buMap.entries())
      .map(([business_unit, v]) => ({
        business_unit,
        open_roles: v.open_roles.size,
        active_candidates: v.active_candidates,
        delivered: v.delivered,
        shortlisted: v.shortlisted,
        hired: v.hired,
        awaiting_decision: v.awaiting_decision,
        blocked: v.blocked,
      }))
      // A "Not assigned to a team" row with nothing in it never fills — drop it.
      .filter(
        (r) =>
          r.business_unit !== "Unassigned" ||
          r.open_roles + r.active_candidates + r.delivered + r.shortlisted + r.hired + r.blocked >
            0,
      )
      .map((r) =>
        r.business_unit === "Unassigned"
          ? { ...r, business_unit: "Not assigned to a team" }
          : r,
      )
      .sort((a, b) => b.active_candidates - a.active_candidates);


    // Time in stage — measured from the stage-entry timestamp the Offers page
    // and the client KPIs read (`candidate_stage_history`, falling back to the
    // delivery date), never from `updated_at`, which any edit resets.
    const activeMatchIds = matchRows
      .filter(
        (m) =>
          !["hired", "rejected", "withdrawn", "not_moving_forward"].includes(
            String(m.stage ?? ""),
          ),
      )
      .map((m) => String(m.id));
    const stageEnteredAt = new Map<string, string>();
    if (activeMatchIds.length > 0) {
      const { data: history } = await s
        .from("candidate_stage_history")
        .select("candidate_match_id, to_stage, created_at")
        .in("candidate_match_id", activeMatchIds);
      const stageByMatch = new Map<string, string>(
        matchRows.map((m) => [String(m.id), String(m.stage)]),
      );
      for (const h of ((history as AnyRow[]) ?? [])) {
        const mid = String(h.candidate_match_id);
        if (stageByMatch.get(mid) !== h.to_stage) continue;
        const at = h.created_at as string | null;
        if (!at) continue;
        const prev = stageEnteredAt.get(mid);
        if (!prev || at > prev) stageEnteredAt.set(mid, at);
      }
    }

    const stageBuckets = new Map<string, number[]>();
    for (const m of matchRows) {
      const stage = String(m.stage ?? "unassigned");
      // P16: Exclude terminal stages from "Time in stage" buckets so the sum 
      // matches the active population and avoids double-counting.
      if (["hired", "rejected", "withdrawn", "not_moving_forward"].includes(stage)) continue;
      const enteredIso = stageEnteredAt.get(String(m.id)) ?? (m.delivered_at as string | null);
      const entered = enteredIso ? new Date(enteredIso) : null;
      if (!entered || Number.isNaN(entered.getTime())) continue;
      const dts = (now.getTime() - entered.getTime()) / 86_400_000;
      const arr = stageBuckets.get(stage) ?? [];
      arr.push(dts);
      stageBuckets.set(stage, arr);
    }
    const time_in_stage = Array.from(stageBuckets.entries())
      .map(([stage, arr]) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
        const p90Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
        return {
          stage,
          count: arr.length,
          avg_days: Math.round(avg * 10) / 10,
          // A percentile needs a real spread behind it. Under five candidates
          // it just repeats the average, so it is withheld.
          p90_days:
            arr.length >= 5 ? Math.round(sorted[p90Idx] * 10) / 10 : null,
        };
      })
      .sort((a, b) => b.avg_days - a.avg_days);


    // ── Bottlenecks ───────────────────────────────────────────────────────
    const pendingPublish = matchRows.filter(
      (m) =>
        String(m.admin_status ?? "") === "ready_to_publish" ||
        (m.approved_score_run_id && String(m.client_visibility ?? "") === "hidden"),
    ).length;
    const stuckProcessing = matchRows.filter((m) =>
      ["queued", "processing", "extracting", "scoring"].includes(
        String(m.processing_state ?? ""),
      ) &&
      m.updated_at &&
      now.getTime() - new Date(m.updated_at).getTime() > 24 * 3600_000,
    ).length;
    const draftPositions = posRows.filter(
      (p) => ["draft", "needs_clarification"].includes(String(p.status)),
    ).length;

    // Open offers pending action
    const { data: offersOpen } = await s
      .from("hire_records")
      .select("id, status, salary_amount, salary_currency, sent_at, updated_at")
      .eq("organization_id", orgId)
      .in("status", ["offer_drafted", "offer_sent", "offer_negotiating", "offer_accepted"]);
    const offerRows: AnyRow[] = offersOpen ?? [];
    const staleOffers = offerRows.filter(
      (o) =>
        String(o.status) === "offer_sent" &&
        o.sent_at &&
        now.getTime() - new Date(o.sent_at).getTime() > 7 * 86_400_000,
    ).length;

    const bottlenecks = [
      {
        key: "pending_publish",
        label: "Candidates waiting to be released to you",
        count: pendingPublish,
        severity: (pendingPublish > 5 ? "warn" : "info") as "info" | "warn",
        hint: "Approved by our team",
      },
      {
        key: "stuck_processing",
        label: "CVs awaiting data refresh >24h",
        count: stuckProcessing,
        severity: (stuckProcessing > 0 ? "crit" : "info") as "info" | "crit",
        hint: "TaaSFlow is reprocessing these — no action needed on your side",
      },
      // Internal evidence-review queue is deliberately not surfaced to clients:
      // it describes our processing, not anything they can act on, and it implies
      // candidates they cannot see.

      {
        key: "draft_positions",
        label: "Roles waiting on intake",
        count: draftPositions,
        severity: (draftPositions > 3 ? "warn" : "info") as "info" | "warn",
        hint: "Finish the intake wizard to open sourcing",
      },
      {
        key: "stale_offers",
        label: "Offers sent >7d with no response",
        count: staleOffers,
        severity: (staleOffers > 0 ? "warn" : "info") as "info" | "warn",
        hint: "Chase candidate or adjust the offer",
      },
    ].filter((b) => b.count > 0 || b.key === "pending_publish");

    // ── Delivery velocity (weekly, last 8 weeks) ──────────────────────────
    const weeks: Array<{ start: Date; end: Date }> = [];
    const anchor = isoWeekStart(now);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(anchor.getTime() - i * 7 * 86_400_000);
      const end = new Date(start.getTime() + 7 * 86_400_000);
      weeks.push({ start, end });
    }
    const delivery_velocity = weeks.map((w) => ({
      week_start: iso(w.start),
      label: weekLabel(w.start),
      delivered: matchRows.filter(
        (m) =>
          m.delivered_at &&
          new Date(m.delivered_at) >= w.start &&
          new Date(m.delivered_at) < w.end,
      ).length,
    }));

    // ── Shortlist quality (weekly avg of the published approved score) ────
    const approvedRunIds = matchRows
      .filter((m) => m.approved_score_run_id && m.delivered_at)
      .map((m) => m.approved_score_run_id);
    let runById = new Map<string, AnyRow>();
    if (approvedRunIds.length > 0) {
      const { data: runs } = await s
        .from("score_runs")
        .select(`id, completed_at, ${PUBLISHED_SCORE_COLUMNS}`)
        .in("id", approvedRunIds);
      runById = new Map((runs as AnyRow[] | null ?? []).map((r) => [r.id, r]));
    }
    const shortlist_quality = weeks.map((w) => {
      const scores: number[] = [];
      for (const m of matchRows) {
        if (!m.delivered_at || !m.approved_score_run_id) continue;
        const delivered = new Date(m.delivered_at);
        if (delivered < w.start || delivered >= w.end) continue;
        const run = runById.get(m.approved_score_run_id);
        const value = publishedScore(run as PublishedScoreRun);
        if (value != null) scores.push(value);
      }
      const avg = scores.length
        ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
        : null;
      return {
        week_start: iso(w.start),
        label: weekLabel(w.start),
        avg_score: avg,
        count: scores.length,
      };
    });

    // ── Finance summary ───────────────────────────────────────────────────
    // Unified hire definition: any candidate whose stage is 'hired' in the
    // canonical pipeline derivation. Executive, Account, Positions and Candidates
    // now all read the same KpiRow predicates.
    const kpis = computeKpis(kpiRows, 0);

    // Hires come from the one selector: confirmed offer records, windowed on
    // the recorded confirmation date.
    const confirmedHireRows = await loadConfirmedHires(s, orgId);
    const hireDate = (h: { hired_at: string | null; start_date: string | null }) =>
      h.hired_at ? new Date(h.hired_at) : null;
    const hires_30d = confirmedHireRows.filter((h) => {
      const d = hireDate(h);
      return d != null && d >= days(30);
    }).length;
    const hires_90d = confirmedHireRows.filter((h) => {
      const d = hireDate(h);
      return d != null && d >= days(90);
    }).length;
    const hires_ytd = confirmedHireRows.filter((h) => {
      const d = hireDate(h);
      return d != null && d >= yearStart;
    }).length;

    const { data: allOffers } = await s
      .from("hire_records")
      .select("status, salary_amount, salary_currency, sent_at")
      .eq("organization_id", orgId);
    const hireRows: AnyRow[] = allOffers ?? [];
    
    const openOfferRows = hireRows.filter((o) =>
      isLiveOffer(String(o.status)),
    );

    const currencyOf = (rows: AnyRow[]): string | null => {
      const c = rows.find((r) => r.salary_currency)?.salary_currency;
      return (c as string) ?? null;
    };
    const sumSalary = (rows: AnyRow[]) => {
      const vals = rows
        .map((r) => Number(r.salary_amount))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (!vals.length) return null;
      return vals.reduce((s, v) => s + v, 0);
    };
    const avgSalary = (rows: AnyRow[]) => {
      const vals = rows
        .map((r) => Number(r.salary_amount))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (!vals.length) return null;
      return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    };

    const projectedRate =
      delivery_velocity.slice(-4).reduce((s, w) => s + w.delivered, 0) / 4;
    
    const withComp = (rows: AnyRow[]) =>
      rows.filter((r) => {
        const n = Number(r.salary_amount);
        return Number.isFinite(n) && n > 0;
      });

    const finance_summary = {
      hires_30d,
      hires_90d,
      hires_ytd,
      open_offers: openOfferRows.length,
      open_offer_value: sumSalary(openOfferRows),
      open_offers_with_compensation: withComp(openOfferRows).length,
      avg_salary: avgSalary(openOfferRows),
      salary_currency: currencyOf(openOfferRows),

      projected_hires_next_30d: Math.min(
        openOfferRows.length,
        Math.max(hires_30d, Math.round(projectedRate / 6)),
      ),
    };

    return {
      organization_id: orgId,
      generated_at: now.toISOString(),
      open_by_region,
      pipeline_by_bu,
      time_in_stage,
      bottlenecks,
      delivery_velocity,
      shortlist_quality,
      finance_summary,
    };
  });
