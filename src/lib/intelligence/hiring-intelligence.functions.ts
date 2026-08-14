import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildIntelligence, type IntelligenceRecords } from "./intelligence-builder";

/**
 * Hiring Intelligence read.
 *
 * Pulls only real records for the caller's organisation (RLS applies as the
 * user), then hands them to a pure builder that computes every metric and its
 * honest state. Nothing is estimated, benchmarked or back-filled here.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const DAY_MS = 86_400_000;

const inputSchema = z.object({
  organization_id: z.string().uuid(),
  days: z.number().int().min(7).max(365).default(90),
  position_id: z.string().uuid().optional(),
});

export const getHiringIntelligence = createServerFn({ method: "POST" })
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

    const now = Date.now();
    const windowMs = data.days * DAY_MS;
    const fromISO = new Date(now - windowMs).toISOString();
    const priorFromISO = new Date(now - windowMs * 2).toISOString();
    const toISO = new Date(now).toISOString();

    const scoped = <T>(q: T): T =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (data.position_id ? (q as any).eq("position_id", data.position_id) : q) as T;

    // ── Positions ────────────────────────────────────────────────────────
    let posQ = supabase
      .from("positions")
      .select("id, title, status, created_at, approved_at, published_at, closed_at, updated_at")
      .eq("organization_id", data.organization_id);
    if (data.position_id) posQ = posQ.eq("id", data.position_id);
    const positions = ((await posQ).data as Row[]) ?? [];

    // ── Candidate matches (client-visible only) ──────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matches = ((await scoped<any>(
      supabase
        .from("candidate_matches")
        .select(
          "id, position_id, stage, canonical_state, client_visibility, eligibility_status, created_at, updated_at, delivered_at, approved_score_run_id, current_score_run_id, evidence_confidence",
        )
        .eq("organization_id", data.organization_id)
        .eq("client_visibility", "visible"),
    )).data as Row[]) ?? [];

    const matchIds = matches.map((m) => m.id);

    let history: Row[] = [];
    if (matchIds.length) {
      const { data: h } = await supabase
        .from("candidate_stage_history")
        .select("candidate_match_id, position_id, from_stage, to_stage, created_at")
        .in("candidate_match_id", matchIds)
        .gte("created_at", priorFromISO);
      history = (h as Row[]) ?? [];
    }

    // ── Score runs ───────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scoreRuns = ((await scoped<any>(
      supabase
        .from("score_runs")
        .select(
          "id, position_id, candidate_match_id, score, final_score, status, fit_band, must_have_coverage, preferred_coverage, requirement_coverage, evidence_confidence, completed_at, started_at",
        )
        .eq("organization_id", data.organization_id)
        .gte("started_at", priorFromISO),
    )).data as Row[]) ?? [];

    // ── Evidence items ───────────────────────────────────────────────────
    let evidenceItems: Row[] = [];
    if (matchIds.length) {
      const { data: ev } = await supabase
        .from("candidate_evidence_items")
        .select(
          "id, candidate_match_id, result, reviewer_status, source_passage, validation_need, integrity_ok, confidence, created_at",
        )
        .in("candidate_match_id", matchIds);
      evidenceItems = (ev as Row[]) ?? [];
    }

    // ── Agent runs ───────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentRuns = ((await scoped<any>(
      supabase
        .from("agent_activity")
        .select("id, agent_key, outcome, position_id, occurred_at, sentence, link_path")
        .eq("organization_id", data.organization_id)
        .gte("occurred_at", priorFromISO),
    )).data as Row[]) ?? [];

    // ── Commitments ──────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commitments = ((await scoped<any>(
      supabase
        .from("position_commitments")
        .select("position_id, first_shortlist_days, shortlist_size, baseline_at")
        .eq("organization_id", data.organization_id),
    )).data as Row[]) ?? [];

    // ── Interviews awaiting confirmation (role risk input) ───────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const interviews = ((await scoped<any>(
      supabase
        .from("interviews")
        .select("id, position_id, status, created_at, scheduled_at")
        .eq("organization_id", data.organization_id),
    )).data as Row[]) ?? [];

    // ── Market / talent availability signals (only if recorded) ──────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const marketSignals = ((await scoped<any>(
      supabase
        .from("search_signals")
        .select("id, signal_kind, signal_key, numeric_value, text_value, role_family, region, observed_at")
        .eq("organization_id", data.organization_id)
        .gte("observed_at", priorFromISO),
    )).data as Row[]) ?? [];

    // ── Work queue items (approvals / actions) ───────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks = ((await scoped<any>(
      supabase
        .from("tasks")
        .select("id, position_id, status, blocking, priority, due_at, task_type, created_at")
        .eq("organization_id", data.organization_id)
        .in("status", ["open", "in_progress"])
        .is("deleted_at", null),
    )).data as Row[]) ?? [];

    // ── Outbound outreach touches (reply-rate comparison) ────────────────
    // Not position-scoped: outreach_touches carries no position_id column.
    const outreachTouches = ((await supabase
      .from("outreach_touches")
      .select("id, direction, state, sent_at, replied_at, created_at, is_test_record")
      .eq("organization_id", data.organization_id)
      .gte("created_at", priorFromISO)).data as Row[]) ?? [];

    const records: IntelligenceRecords = {
      positions,
      matches,
      history,
      scoreRuns,
      evidenceItems,
      agentRuns,
      commitments,
      interviews,
      marketSignals,
      tasks,
      outreachTouches,
      window: {
        days: data.days,
        from: fromISO,
        priorFrom: priorFromISO,
        to: toISO,
      },
      positionId: data.position_id ?? null,
    };

    return buildIntelligence(records, new Date(now));
  });

export const getIntelligencePositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ organization_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: pos } = await context.supabase
      .from("positions")
      .select("id, title, status")
      .eq("organization_id", data.organization_id)
      .order("title");
    return {
      positions: ((pos as Row[]) ?? []).map((p) => ({
        id: p.id as string,
        title: p.title as string,
        status: p.status as string,
      })),
    };
  });
