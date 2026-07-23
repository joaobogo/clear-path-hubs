// Weekly Business Review (WBR) aggregation.
//
// Read-only server functions that compute the metrics rendered on the
// `/admin/wbr` screen. All counts are staff-scoped and use `supabaseAdmin` so
// admins see cross-org totals. Do NOT expose this fn to client dashboards
// without adding per-organization filters.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function requireStaff(userId: string) {
  const s = await getAdmin();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

const rangeSchema = z
  .object({
    weeks_back: z.number().int().min(0).max(12).default(0),
    organization_id: z.string().uuid().nullable().optional(),
  })
  .default({ weeks_back: 0 });

export const getWbrReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => rangeSchema.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();

    // Anchor to the ISO week (Mon 00:00 UTC → next Mon 00:00 UTC).
    const now = new Date();
    const dayMs = 24 * 3600_000;
    const day = now.getUTCDay(); // 0..6, Sun=0
    const daysFromMon = (day + 6) % 7;
    const thisMon = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        daysFromMon * dayMs,
    );
    const weekStart = new Date(thisMon.getTime() - data.weeks_back * 7 * dayMs);
    const weekEnd = new Date(weekStart.getTime() + 7 * dayMs);
    const prevStart = new Date(weekStart.getTime() - 7 * dayMs);

    const inRange = (col: string) => (q: AnyRow) =>
      q.gte(col, weekStart.toISOString()).lt(col, weekEnd.toISOString());
    const inPrev = (col: string) => (q: AnyRow) =>
      q.gte(col, prevStart.toISOString()).lt(col, weekStart.toISOString());

    const orgFilter = (q: AnyRow) =>
      data.organization_id ? q.eq("organization_id", data.organization_id) : q;

    const count = async (
      table: string,
      apply: (q: AnyRow) => AnyRow,
    ): Promise<number> => {
      const q = apply(
        orgFilter(s.from(table).select("id", { count: "exact", head: true })),
      );
      const { count: c } = await q;
      return c ?? 0;
    };

    // ── Roles opened ────────────────────────────────────────────────────
    const [roles_opened, roles_opened_prev] = await Promise.all([
      count("positions", (q) => inRange("created_at")(q)),
      count("positions", (q) => inPrev("created_at")(q)),
    ]);

    // ── Candidates delivered (published to client this week) ────────────
    const [candidates_delivered, candidates_delivered_prev] = await Promise.all([
      count("candidate_matches", (q) =>
        inRange("published_at")(q.eq("client_visibility", "visible")),
      ),
      count("candidate_matches", (q) =>
        inPrev("published_at")(q.eq("client_visibility", "visible")),
      ),
    ]);

    // ── Interviews scheduled ────────────────────────────────────────────
    const [interviews_scheduled, interviews_scheduled_prev] = await Promise.all([
      count("interviews", (q) => inRange("created_at")(q)),
      count("interviews", (q) => inPrev("created_at")(q)),
    ]);

    // ── Approvals stuck (scored & pending > 48h) ────────────────────────
    const twoDaysAgo = new Date(Date.now() - 2 * dayMs).toISOString();
    const approvals_stuck = await count("candidate_matches", (q) =>
      q
        .eq("processing_state", "scored")
        .eq("admin_status", "pending")
        .lt("updated_at", twoDaysAgo),
    );

    // ── Bottlenecks (in-flight aged > 24h grouped by processing_state) ──
    const dayAgo = new Date(Date.now() - dayMs).toISOString();
    const bottleneckStates = [
      "queued",
      "parsing",
      "enriching",
      "ready_to_score",
      "ocr_required",
      "provider_blocked",
      "manual_review_required",
      "failed",
    ];
    const bottlenecks = await Promise.all(
      bottleneckStates.map(async (state) => ({
        state,
        count: await count("candidate_matches", (q) =>
          q.eq("processing_state", state).lt("processing_updated_at", dayAgo),
        ),
      })),
    );

    // ── Source effectiveness (this week's applications by source) ───────
    const { data: appsThisWeek } = await orgFilter(
      s
        .from("candidate_matches")
        .select("id,source,processing_state,admin_status,client_visibility")
        .gte("created_at", weekStart.toISOString())
        .lt("created_at", weekEnd.toISOString()),
    );
    const sourceMap = new Map<string, { total: number; scored: number; delivered: number }>();
    for (const row of (appsThisWeek ?? []) as AnyRow[]) {
      const key = row.source || "direct";
      const bucket = sourceMap.get(key) ?? { total: 0, scored: 0, delivered: 0 };
      bucket.total += 1;
      if (row.processing_state === "scored") bucket.scored += 1;
      if (row.client_visibility === "visible") bucket.delivered += 1;
      sourceMap.set(key, bucket);
    }
    const source_effectiveness = Array.from(sourceMap.entries())
      .map(([source, v]) => ({
        source,
        total: v.total,
        scored: v.scored,
        delivered: v.delivered,
        conversion: v.total ? Math.round((v.delivered / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── Top open positions (still recruiting) ───────────────────────────
    const { data: topPositions } = await orgFilter(
      s
        .from("positions")
        .select(
          "id,title,status,created_at,organizations(name),candidate_matches(id,client_visibility,admin_status)",
        )
        .in("status", ["approved", "published", "submitted"])
        .order("created_at", { ascending: false })
        .limit(10),
    );
    const top_open_positions = ((topPositions ?? []) as AnyRow[]).map((p) => {
      const matches = (p.candidate_matches ?? []) as AnyRow[];
      return {
        id: p.id,
        title: p.title,
        organization: p.organizations?.name ?? null,
        opened_at: p.created_at,
        total_candidates: matches.length,
        delivered: matches.filter((m) => m.client_visibility === "visible").length,
        pending: matches.filter(
          (m) => m.admin_status === "pending" && m.client_visibility !== "visible",
        ).length,
      };
    });

    // ── Recent client requests (recompute) ──────────────────────────────
    const { data: clientRequests } = await s
      .from("score_decisions")
      .select(
        "id,decision_type,reason,created_at,candidate_matches(candidate_profiles(full_name),positions(title,organizations(name)))",
      )
      .eq("decision_type", "request_recompute")
      .gte("created_at", weekStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      prev_week_start: prevStart.toISOString(),
      totals: {
        roles_opened,
        roles_opened_prev,
        candidates_delivered,
        candidates_delivered_prev,
        interviews_scheduled,
        interviews_scheduled_prev,
        approvals_stuck,
      },
      bottlenecks,
      source_effectiveness,
      top_open_positions,
      client_requests: (clientRequests ?? []) as AnyRow[],
      generated_at: new Date().toISOString(),
    };
  });

const commitmentsSchema = z.object({
  week_start: z.string().datetime(),
  commitments: z
    .array(
      z.object({
        title: z.string().min(3).max(240),
        owner: z.string().max(120).optional().nullable(),
        due: z.string().max(60).optional().nullable(),
      }),
    )
    .max(20),
});

// Commitments are stored in audit_events as a lightweight append-only log.
// Keeps the schema surface small and reuses the tenant-safe write path.
export const saveWbrCommitments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => commitmentsSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    await s.from("audit_events").insert({
      actor_user_id: context.userId,
      action: "wbr.commitments.recorded",
      entity_type: "wbr",
      entity_id: data.week_start,
      after_state: { commitments: data.commitments } as never,
    });
    return { ok: true, saved: data.commitments.length };
  });

export const getWbrCommitments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ week_start: z.string().datetime() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: rows } = await s
      .from("audit_events")
      .select("after_state,created_at,actor_user_id")
      .eq("entity_type", "wbr")
      .eq("entity_id", data.week_start)
      .eq("action", "wbr.commitments.recorded")
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (rows ?? [])[0] as AnyRow | undefined;
    const commitments = (row?.after_state?.commitments ?? []) as AnyRow[];
    return { commitments, recorded_at: row?.created_at ?? null };
  });
