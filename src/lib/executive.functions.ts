// Executive Portfolio View — leadership-layer aggregations for enterprise clients.
//
// All reads are scoped to a single organization and go through the authenticated
// Supabase client so RLS applies as the caller. Staff can pass any org they have
// visibility into via the standard client-context path.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isOpenRoleStatus, isFilledRole } from "@/lib/client-role-open";
import { laneFor } from "@/lib/client-pipeline-lane";
import { isLiveOffer, qualifiesAsHire } from "@/lib/offer-hire";
import { loadKpiRows, computeKpis } from "@/lib/client-kpi.server";

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
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${m}/${day}`;
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
    blocked: number;
  }>;
  time_in_stage: Array<{ stage: string; count: number; avg_days: number; p90_days: number }>;
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
    /** MAJOR units. */
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
      .select("id, department, location, status")
      .eq("organization_id", orgId);
    const posRows: AnyRow[] = positions ?? [];


    // ── Matches (pipeline by BU, time-in-stage, blocked) ──────────────────
    const { data: matches } = await s
      .from("candidate_matches")
      .select(
        "id, position_id, stage, admin_status, client_visibility, delivered_at, updated_at, processing_state, approved_score_run_id",
      )
      .eq("organization_id", orgId);
    const matchRows: AnyRow[] = matches ?? [];
    const posById = new Map<string, AnyRow>(posRows.map((p) => [p.id, p]));

    // Open / filled by region, using the shared role derivations so this strip
    // agrees with Overview, the Roles list and the KPI tiles. A role counts as
    // filled once its pipeline holds a hire, not only when someone manually
    // flipped the position status.
    const hiredPositionIds = new Set<string>(
      matchRows
        .filter((m) => laneFor({ stage: String(m.stage) }) === "hired")
        .map((m) => String(m.position_id)),
    );
    const regionMap = new Map<string, { open: number; filled: number; total: number }>();
    for (const p of posRows) {
      const region = normalizeRegion(p.location);
      const bucket = regionMap.get(region) ?? { open: 0, filled: 0, total: 0 };
      bucket.total += 1;
      if (isOpenRoleStatus(p.status)) bucket.open += 1;
      if (isFilledRole({ id: String(p.id), status: p.status }, hiredPositionIds)) {
        bucket.filled += 1;
      }
      regionMap.set(region, bucket);
    }
    const open_by_region = Array.from(regionMap.entries())
      .map(([region, v]) => ({ region, ...v }))
      .sort((a, b) => b.open - a.open || b.total - a.total);

    // Pipeline by business unit (department)
    const buMap = new Map<
      string,
      {
        open_roles: Set<string>;
        active_candidates: number;
        delivered: number;
        shortlisted: number;
        hired: number;
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
          blocked: 0,
        };
        buMap.set(bu, v);
      }
      return v;
    };
    for (const p of posRows) {
      const bu = (p.department as string | null)?.trim() || "Unassigned";
      const v = ensureBu(bu);
      if (isOpenRoleStatus(p.status)) v.open_roles.add(p.id);
    }
    for (const m of matchRows) {
      const p = posById.get(m.position_id);
      const bu = ((p?.department as string | null) ?? "").trim() || "Unassigned";
      const v = ensureBu(bu);
      const stage = String(m.stage ?? "");
      if (!["rejected", "hired", "withdrawn"].includes(stage)) v.active_candidates += 1;
      if (m.delivered_at) v.delivered += 1;
      if (stage === "shortlisted") v.shortlisted += 1;
      if (stage === "hired") v.hired += 1;
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
        blocked: v.blocked,
      }))
      .sort((a, b) => b.active_candidates - a.active_candidates);

    // Time in stage — days since last updated per stage
    const stageBuckets = new Map<string, number[]>();
    for (const m of matchRows) {
      const stage = String(m.stage ?? "unassigned");
      if (["hired", "rejected", "withdrawn"].includes(stage)) continue;
      const updated = m.updated_at ? new Date(m.updated_at) : null;
      if (!updated) continue;
      const dts = (now.getTime() - updated.getTime()) / 86_400_000;
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
          p90_days: Math.round(sorted[p90Idx] * 10) / 10,
        };
      })
      .sort((a, b) => b.p90_days - a.p90_days);

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
    const blockedMatches = matchRows.filter((m) =>
      ["failed", "error"].includes(String(m.processing_state ?? "")),
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
        label: "Candidates awaiting publish",
        count: pendingPublish,
        severity: (pendingPublish > 5 ? "warn" : "info") as "info" | "warn",
        hint: "Cleared from the Publish desk",
      },
      {
        key: "stuck_processing",
        label: "CVs awaiting data refresh >24h",
        count: stuckProcessing,
        severity: (stuckProcessing > 0 ? "crit" : "info") as "info" | "crit",
        hint: "TaaSFlow is reprocessing these — no action needed on your side",
      },
      {
        key: "blocked_matches",
        label: "CVs needing evidence review",
        count: blockedMatches,
        severity: (blockedMatches > 0 ? "warn" : "info") as "info" | "warn",
        hint: "TaaSFlow is running evidence review before delivery",
      },
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

    // ── Shortlist quality (weekly avg approved final_score) ───────────────
    const approvedRunIds = matchRows
      .filter((m) => m.approved_score_run_id && m.delivered_at)
      .map((m) => m.approved_score_run_id);
    let runById = new Map<string, AnyRow>();
    if (approvedRunIds.length > 0) {
      const { data: runs } = await s
        .from("score_runs")
        .select("id, final_score, completed_at")
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
        if (run?.final_score != null) scores.push(Number(run.final_score));
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
    const kpiRows = await loadKpiRows(s, orgId);
    const kpis = computeKpis(kpiRows, 0);

    // Filter hires by window using their confirmed hired_at timestamp
    const hiredMatches = kpiRows.filter(r => r.stage === 'hired' && r.stage_entered_at);
    
    const hires_30d = hiredMatches.filter(
      (h) => new Date(h.stage_entered_at!) >= days(30),
    ).length;
    const hires_90d = hiredMatches.filter(
      (h) => new Date(h.stage_entered_at!) >= days(90),
    ).length;
    const hires_ytd = hiredMatches.filter(
      (h) => new Date(h.stage_entered_at!) >= yearStart,
    ).length;

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
    
    const finance_summary = {
      hires_30d,
      hires_90d,
      hires_ytd,
      open_offers: openOfferRows.length,
      open_offer_value: sumSalary(openOfferRows),
      avg_salary: avgSalary(hireRows),
      salary_currency: currencyOf(hireRows),
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
