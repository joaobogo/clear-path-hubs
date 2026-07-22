// Admin dashboard service — canonical read + mutation server fns for Phase 7.
// Every mutation validates input, enforces staff, writes an audit event, and returns
// enough info for the caller to refresh its cache. Callers should use useMutation +
// queryClient.invalidateQueries; no button should only display a toast.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function isStaff(userId: string): Promise<boolean> {
  const s = await getAdmin();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  return data === true;
}

async function requireStaff(userId: string) {
  if (!(await isStaff(userId))) throw new Error("forbidden");
}

async function writeAudit(opts: {
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  organization_id?: string | null;
  before?: unknown;
  after?: unknown;
  trace_id?: string;
}) {
  const s = await getAdmin();
  await s.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    organization_id: opts.organization_id ?? null,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
    trace_id: opts.trace_id ?? null,
  });
}

const traceId = () =>
  `ad_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

// ─── Overview ────────────────────────────────────────────────────────────────

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    const count = async (
      table: string,
      apply: (q: AnyRow) => AnyRow,
    ): Promise<number> => {
      const q = apply(s.from(table).select("id", { count: "exact", head: true }));
      const { count: c } = await q;
      return c ?? 0;
    };

    const [
      new_intakes,
      positions_review,
      candidates_review,
      candidates_ready,
      processing_failures,
      client_requests,
      aging,
    ] = await Promise.all([
      count("positions", (q) => q.eq("status", "submitted")),
      count("positions", (q) => q.in("status", ["submitted", "needs_clarification"])),
      count("candidate_matches", (q) =>
        q.eq("admin_status", "pending").eq("processing_state", "scored"),
      ),
      count("candidate_matches", (q) =>
        q.eq("admin_status", "approved").eq("client_visibility", "hidden"),
      ),
      count("candidate_matches", (q) =>
        q.in("processing_state", ["failed", "provider_blocked", "ocr_required"]),
      ),
      count("score_decisions", (q) =>
        q.eq("decision_type", "request_recompute").gte("created_at", weekAgo),
      ),
      count("candidate_matches", (q) =>
        q
          .in("processing_state", ["queued", "parsing", "enriching", "ready_to_score"])
          .lt("processing_updated_at", dayAgo),
      ),
    ]);

    return {
      new_intakes,
      positions_review,
      candidates_review,
      candidates_ready,
      processing_failures,
      client_requests,
      aging,
      generated_at: new Date().toISOString(),
    };
  });

// ─── Clients & Positions ─────────────────────────────────────────────────────

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        q: z.string().optional().default(""),
        status: z.enum(["prospect", "active", "paused", "closed"]).optional(),
        include_archived: z.boolean().optional().default(false),
        sort: z
          .enum(["updated_desc", "updated_asc", "name_asc", "name_desc", "status_asc"])
          .optional()
          .default("updated_desc"),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    let q = s
      .from("organizations")
      .select("id,name,status,domain,industry,updated_at,archived_at,onboarding_status,dashboard_status")
      .limit(500);
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    if (data.status) q = q.eq("status", data.status);
    if (!data.include_archived) q = q.is("archived_at", null);
    switch (data.sort) {
      case "updated_asc": q = q.order("updated_at", { ascending: true }); break;
      case "name_asc": q = q.order("name", { ascending: true }); break;
      case "name_desc": q = q.order("name", { ascending: false }); break;
      case "status_asc": q = q.order("status", { ascending: true }).order("name", { ascending: true }); break;
      default: q = q.order("updated_at", { ascending: false });
    }
    const { data: rows } = await q;
    const orgIds = (rows ?? []).map((r: AnyRow) => r.id);
    let counts: Record<string, { positions: number; active: number }> = {};
    if (orgIds.length) {
      const { data: pos } = await s
        .from("positions")
        .select("organization_id,status")
        .in("organization_id", orgIds);
      for (const p of (pos ?? []) as AnyRow[]) {
        const c = (counts[p.organization_id] ??= { positions: 0, active: 0 });
        c.positions += 1;
        if (p.status === "active") c.active += 1;
      }
    }
    return (rows ?? []).map((r: AnyRow) => ({
      ...r,
      positions_total: counts[r.id]?.positions ?? 0,
      positions_active: counts[r.id]?.active ?? 0,
    }));
  });


export const getClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const [orgRes, membersRes, positionsRes] = await Promise.all([
      s.from("organizations").select("*").eq("id", data.id).maybeSingle(),
      s
        .from("memberships")
        .select("id,role,status,created_at,profiles(auth_user_id,full_name,email)")
        .eq("organization_id", data.id)
        .order("created_at", { ascending: false }),
      s
        .from("positions")
        .select(
          "id,title,status,visibility,work_model,employment_type,seniority,location,updated_at,published_at,created_at",
        )
        .eq("organization_id", data.id)
        .order("updated_at", { ascending: false }),
    ]);
    if (!orgRes.data) return null;
    return {
      organization: orgRes.data,
      members: (membersRes.data ?? []) as AnyRow[],
      positions: (positionsRes.data ?? []) as AnyRow[],
    };
  });

export const listPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        status: z.string().optional(),
        q: z.string().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    let q = s
      .from("positions")
      .select(
        "id,title,status,visibility,updated_at,organizations(id,name)",
      )
      .order("updated_at", { ascending: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    if (data.q) q = q.ilike("title", `%${data.q}%`);
    const { data: rows } = await q;
    return (rows ?? []) as AnyRow[];
  });

export const getPosition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const [posRes, screeningRes, matchesRes] = await Promise.all([
      s
        .from("positions")
        .select("*,organizations(id,name,status,domain)")
        .eq("id", data.id)
        .maybeSingle(),
      s
        .from("screening_questions")
        .select("*")
        .eq("position_id", data.id)
        .order("position_order", { ascending: true }),
      s
        .from("candidate_matches")
        .select(
          "id,stage,admin_status,client_visibility,processing_state,updated_at,candidate_profiles(full_name,email),score_runs!candidate_matches_current_score_run_id_fkey(score,fit_label)",
        )
        .eq("position_id", data.id)
        .order("updated_at", { ascending: false })
        .limit(200),
    ]);
    if (!posRes.data) return null;
    return {
      position: posRes.data,
      screening: (screeningRes.data ?? []) as AnyRow[],
      matches: (matchesRes.data ?? []) as AnyRow[],
    };
  });

const positionPatch = z.object({
  id: z.string().uuid(),
  patch: z
    .object({
      title: z.string().min(3).max(200).optional(),
      description: z.string().max(20_000).optional(),
      location: z.string().max(200).nullable().optional(),
      work_model: z.enum(["remote", "hybrid", "onsite"]).nullable().optional(),
      employment_type: z
        .enum(["full_time", "part_time", "contract", "temporary", "internship"])
        .nullable()
        .optional(),
      seniority: z.string().max(60).nullable().optional(),
      requirements: z.array(z.unknown()).optional(),
      preferred_requirements: z.array(z.unknown()).optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "no_changes"),
  reason: z.string().max(500).optional(),
});

export const updatePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => positionPatch.parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const trace_id = traceId();
    const s = await getAdmin();
    const { data: before } = await s
      .from("positions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("position_not_found");
    const { data: after, error } = await s
      .from("positions")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit({
      actor: context.userId,
      action: "position.update",
      entity_type: "position",
      entity_id: data.id,
      organization_id: before.organization_id,
      before,
      after,
      trace_id,
    });
    return { ok: true as const, trace_id, position: after };
  });

const statusTransition = z.object({
  id: z.string().uuid(),
  action: z.enum([
    "request_clarification",
    "approve",
    "activate",
    "pause",
    "close",
    "reopen",
  ]),
  reason: z.string().max(500).optional(),
});

const STATUS_MAP: Record<string, string> = {
  request_clarification: "needs_clarification",
  approve: "approved",
  activate: "active",
  pause: "paused",
  close: "closed",
  reopen: "approved",
};

export const setPositionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => statusTransition.parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const trace_id = traceId();
    const s = await getAdmin();
    const { data: before } = await s
      .from("positions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("position_not_found");
    const next = STATUS_MAP[data.action];
    const patch: AnyRow = { status: next };
    if (data.action === "approve") patch.approved_at = new Date().toISOString();
    if (data.action === "activate") patch.published_at = new Date().toISOString();
    if (data.action === "close") patch.closed_at = new Date().toISOString();
    const { data: after, error } = await s
      .from("positions")
      .update(patch)
      .eq("id", data.id)
      .select("id,status,visibility,approved_at,published_at,closed_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit({
      actor: context.userId,
      action: `position.${data.action}`,
      entity_type: "position",
      entity_id: data.id,
      organization_id: before.organization_id,
      before: { status: before.status, visibility: before.visibility },
      after,
      trace_id,
    });
    return { ok: true as const, trace_id, position: after };
  });

const visibilityInput = z.object({
  id: z.string().uuid(),
  visibility: z.enum(["public", "private", "internal"]),
});

export const setPositionVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => visibilityInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const trace_id = traceId();
    const s = await getAdmin();
    const { data: before } = await s
      .from("positions")
      .select("id,organization_id,visibility")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("position_not_found");
    const { data: after, error } = await s
      .from("positions")
      .update({ visibility: data.visibility })
      .eq("id", data.id)
      .select("id,visibility")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit({
      actor: context.userId,
      action: "position.visibility",
      entity_type: "position",
      entity_id: data.id,
      organization_id: before.organization_id,
      before: { visibility: before.visibility },
      after,
      trace_id,
    });
    return { ok: true as const, trace_id, position: after };
  });

// ─── Publish Desk ────────────────────────────────────────────────────────────

export const getPublishQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data } = await s
      .from("candidate_matches")
      .select(
        "id,updated_at,admin_status,client_visibility,processing_state,current_score_run_id,candidate_profiles(full_name,email),positions(id,title,organizations(name)),score_runs!candidate_matches_current_score_run_id_fkey(score,fit_label,contradiction_status,must_have_coverage)",
      )
      .eq("processing_state", "scored")
      .in("admin_status", ["pending", "approved", "on_hold"])
      .neq("client_visibility", "visible")
      .order("updated_at", { ascending: false })
      .limit(100);
    return (data ?? []) as AnyRow[];
  });

// Sanitized client preview — returns the SAME DTO the real Client view uses,
// so Admin Preview ≡ Client View by construction. Selects the same columns
// `getClientCandidate` selects, then passes through `toClientCandidateDTO`.
export const getClientPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: m } = await s
      .from("candidate_matches")
      .select(
        "id,stage,delivered_at,current_score_run_id,approved_score_run_id," +
        "candidate_profiles(full_name,location,headline,availability,skills,experience)," +
        "positions(id,title,organizations(name))," +
        "score_runs!candidate_matches_current_score_run_id_fkey(" +
          "score,fit_label,explanation,result,must_have_coverage,preferred_coverage," +
          "evidence,requirement_coverage,strengths,concerns" +
        ")",
      )
      .eq("id", data.match_id)
      .maybeSingle();
    if (!m) return null;
    const { toClientCandidateDTO } = await import("@/lib/client-kpi.server");
    return toClientCandidateDTO(m as AnyRow);
  });


// ─── Pipeline Health ─────────────────────────────────────────────────────────

export const getPipelineHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const staleCutoff = new Date(Date.now() - 24 * 3600_000).toISOString();

    // Group counts by processing_state
    const { data: matches } = await s
      .from("candidate_matches")
      .select("id,processing_state,processing_updated_at");
    const stateCounts: Record<string, number> = {};
    let stale = 0;
    for (const m of (matches ?? []) as AnyRow[]) {
      stateCounts[m.processing_state] = (stateCounts[m.processing_state] ?? 0) + 1;
      if (
        ["queued", "parsing", "enriching", "ready_to_score"].includes(
          m.processing_state,
        ) &&
        m.processing_updated_at < staleCutoff
      )
        stale += 1;
    }

    // Recent failed jobs
    const { data: failedJobs } = await s
      .from("processing_jobs")
      .select("id,job_type,error_code,error_message,trace_id,created_at,entity_id")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(50);

    // Provider errors (last 7d)
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { count: providerIncidents } = await s
      .from("processing_jobs")
      .select("id", { count: "exact", head: true })
      .eq("error_code", "provider_error")
      .gte("created_at", weekAgo);

    return {
      states: stateCounts,
      stale,
      failed_jobs: (failedJobs ?? []) as AnyRow[],
      provider_incidents: providerIncidents ?? 0,
    };
  });

// ─── Match visibility (admin) ────────────────────────────────────────────────

const matchVisInput = z.object({
  match_id: z.string().uuid(),
  visibility: z.enum(["hidden", "visible"]),
});

export const setMatchClientVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => matchVisInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const trace_id = traceId();
    const s = await getAdmin();
    const { data: before } = await s
      .from("candidate_matches")
      .select("id,organization_id,client_visibility")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!before) throw new Error("match_not_found");
    const { data: after, error } = await s
      .from("candidate_matches")
      .update({ client_visibility: data.visibility })
      .eq("id", data.match_id)
      .select("id,client_visibility")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit({
      actor: context.userId,
      action: `match.visibility.${data.visibility}`,
      entity_type: "candidate_match",
      entity_id: data.match_id,
      organization_id: before.organization_id,
      before: { visibility: before.client_visibility },
      after,
      trace_id,
    });
    return { ok: true as const, trace_id, match: after, action: data.visibility };
  });


const candidateFilter = z.object({
  q: z.string().optional(),
  organization_id: z.string().uuid().optional(),
  position_id: z.string().uuid().optional(),
  stage: z.string().optional(),
  admin_status: z.string().optional(),
  processing_state: z.string().optional(),
  client_visibility: z.string().optional(),
  min_score: z.number().min(0).max(100).optional(),
  max_score: z.number().min(0).max(100).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  sort: z.enum(["updated_desc", "updated_asc", "score_desc", "score_asc", "created_desc"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const searchCandidateMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => candidateFilter.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const limit = data.limit ?? 50;
    const offset = data.offset ?? 0;
    const sort = data.sort ?? "updated_desc";

    let q = s
      .from("candidate_matches")
      .select(
        "id,application_id,stage,admin_status,client_visibility,processing_state,updated_at,created_at,organization_id,position_id,candidate_profile_id,candidate_profiles(full_name,email),positions(id,title,organization_id,organizations(id,name)),score_runs!candidate_matches_current_score_run_id_fkey(score,fit_label,contradiction_status)",
        { count: "exact" },
      );

    if (sort === "updated_desc") q = q.order("updated_at", { ascending: false });
    else if (sort === "updated_asc") q = q.order("updated_at", { ascending: true });
    else if (sort === "created_desc") q = q.order("created_at", { ascending: false });

    q = q.range(offset, offset + limit - 1);

    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    if (data.position_id) q = q.eq("position_id", data.position_id);
    if (data.stage) q = q.eq("stage", data.stage);
    if (data.admin_status) q = q.eq("admin_status", data.admin_status);
    if (data.processing_state) q = q.eq("processing_state", data.processing_state);
    if (data.client_visibility) q = q.eq("client_visibility", data.client_visibility);
    if (data.date_from) q = q.gte("updated_at", data.date_from);
    if (data.date_to) q = q.lte("updated_at", data.date_to);

    const { data: rows, count } = await q;
    let out = (rows ?? []) as AnyRow[];
    if (data.q) {
      const needle = data.q.toLowerCase();
      out = out.filter((r) => {
        const n = (r.candidate_profiles?.full_name ?? "").toLowerCase();
        const e = (r.candidate_profiles?.email ?? "").toLowerCase();
        return n.includes(needle) || e.includes(needle);
      });
    }
    if (data.min_score != null) {
      const min = data.min_score;
      out = out.filter((r) => (r.score_runs?.score ?? -1) >= min);
    }
    if (data.max_score != null) {
      const max = data.max_score;
      out = out.filter((r) => (r.score_runs?.score ?? 101) <= max);
    }
    if (sort === "score_desc") {
      out.sort((a, b) => (b.score_runs?.score ?? -1) - (a.score_runs?.score ?? -1));
    } else if (sort === "score_asc") {
      out.sort((a, b) => (a.score_runs?.score ?? 101) - (b.score_runs?.score ?? 101));
    }
    return { rows: out, total: count ?? out.length, limit, offset };
  });

// ─── Filter option helpers ───────────────────────────────────────────────────

export const listOrgOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data } = await s
      .from("organizations")
      .select("id,name")
      .order("name", { ascending: true })
      .limit(500);
    return (data ?? []) as Array<{ id: string; name: string }>;
  });

export const listPositionOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ organization_id: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    let q = s
      .from("positions")
      .select("id,title,organization_id,organizations(name)")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    const { data: rows } = await q;
    return (rows ?? []) as AnyRow[];
  });

// ─── Client workspace: canonical update, activity, tenant-scoped candidates ─

const ORG_STATUS = z.enum(["prospect", "active", "paused", "closed"]);
const ONBOARDING_STATUS = z.enum(["not_started", "in_progress", "live", "on_hold"]);
const DASHBOARD_STATUS = z.enum(["inactive", "active", "maintenance"]);

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional();

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            name: z.string().trim().min(1).max(200).optional(),
            website: nullableText(500),
            domain: nullableText(200),
            industry: nullableText(120),
            headquarters: nullableText(200),
            locations: nullableText(1000),
            phone: nullableText(80),
            primary_contact_name: nullableText(200),
            primary_contact_email: z
              .string()
              .trim()
              .max(320)
              .transform((v) => (v.length === 0 ? null : v))
              .nullable()
              .optional()
              .refine(
                (v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
                { message: "invalid_email" },
              ),
            internal_notes: nullableText(20_000),
            status: ORG_STATUS.optional(),
            onboarding_status: ONBOARDING_STATUS.optional(),
            dashboard_status: DASHBOARD_STATUS.optional(),
          })
          .refine((p) => Object.keys(p).length > 0, { message: "empty_patch" }),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const trace = traceId();
    const { data: before } = await s
      .from("organizations")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error(`organization_not_found [${trace}]`);
    if (before.archived_at) throw new Error(`organization_archived [${trace}]`);
    const { data: after, error } = await s
      .from("organizations")
      .update({ ...data.patch, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`update_failed:${error.message} [${trace}]`);
    if (!after) throw new Error(`readback_failed [${trace}]`);
    await writeAudit({
      actor: context.userId,
      action: "organization.update",
      entity_type: "organizations",
      entity_id: data.id,
      organization_id: data.id,
      before,
      after,
      trace_id: trace,
    });
    return { ok: true as const, organization: after, trace_id: trace };
  });

export const archiveOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        confirm_name: z.string().trim().min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const trace = traceId();
    const { data: before } = await s
      .from("organizations")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error(`organization_not_found [${trace}]`);
    if (before.name.trim().toLowerCase() !== data.confirm_name.trim().toLowerCase()) {
      throw new Error(`confirmation_mismatch [${trace}]`);
    }
    const now = new Date().toISOString();
    const { data: after, error } = await s
      .from("organizations")
      .update({ archived_at: now, status: "closed", dashboard_status: "inactive", updated_at: now })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`archive_failed:${error.message} [${trace}]`);
    await writeAudit({
      actor: context.userId,
      action: "organization.archive",
      entity_type: "organizations",
      entity_id: data.id,
      organization_id: data.id,
      before,
      after,
      trace_id: trace,
    });
    return { ok: true as const, organization: after, trace_id: trace };
  });


export const getClientActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).optional().default(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: rows } = await s
      .from("audit_events")
      .select("id,action,entity_type,entity_id,created_at,actor_user_id,trace_id")
      .eq("organization_id", data.id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return (rows ?? []) as AnyRow[];
  });

export const getClientCandidatesForOrg = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), limit: z.number().int().min(1).max(500).optional().default(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: rows } = await s
      .from("candidate_matches")
      .select(
        "id,current_stage,processing_state,fit_band,fit_score_final,admin_status,client_visibility,updated_at,candidate_profiles(id,full_name,email),positions(id,title)",
      )
      .eq("organization_id", data.id)
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    return (rows ?? []) as AnyRow[];
  });
