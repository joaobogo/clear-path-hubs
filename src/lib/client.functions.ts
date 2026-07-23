// Client workspace service — canonical read + mutation server fns for Phase 8.
// All reads go through the authenticated Supabase client (RLS applies as the caller).
// KPI counts are computed via the canonical service in client-kpi.server.ts so
// every dashboard tile and drill-through view stays reconciled.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  loadKpiRows,
  computeKpis,
  toClientCandidateDTO,
  TOP_FIT_LABELS,
  type MatchStage,
  type KpiRow,
} from "@/lib/client-kpi.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const traceId = () =>
  `cl_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

// ─── Types ──────────────────────────────────────────────────────────────────

export type ClientRole =
  | "client_admin"
  | "client_editor"
  | "client_viewer"
  | "platform_admin"
  | "operations";

// MatchStage and TOP_FIT_LABELS are re-exported from the canonical KPI service
// so existing imports from this module continue to work.
export { TOP_FIT_LABELS };
export type { MatchStage };

// ─── Context resolution ─────────────────────────────────────────────────────

async function resolveContext(supabase: AnyRow, userId: string, orgId?: string) {
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("organization_id, role, status, organizations(id, name)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  const clientMemberships = (memberships as AnyRow[]).filter((m) =>
    ["client_admin", "client_editor", "client_viewer"].includes(m.role),
  );
  const staffMemberships = (memberships as AnyRow[]).filter((m) =>
    ["platform_admin", "operations"].includes(m.role),
  );
  const isStaff = staffMemberships.length > 0;
  let active = clientMemberships.find((m) => m.organization_id === orgId);
  if (!active && !orgId) active = clientMemberships[0];
  // Staff can view any org they name.
  if (!active && isStaff && orgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle();
    if (org) {
      active = {
        organization_id: org.id,
        role: "client_admin" as const,
        organizations: org,
      };
    }
  }
  return { active, memberships: clientMemberships, isStaff };
}

export const getClientContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { orgId?: string }) => input ?? {})
  .handler(async ({ context, data }) => {
    const { active, memberships, isStaff } = await resolveContext(
      context.supabase,
      context.userId,
      data.orgId,
    );
    if (!active) {
      return {
        active: null as null | {
          organization_id: string;
          role: ClientRole;
          name: string;
        },
        organizations: memberships.map((m) => ({
          id: m.organization_id,
          role: m.role as ClientRole,
          name: m.organizations?.name ?? "Organization",
        })),
        isStaff,
      };
    }
    return {
      active: {
        organization_id: active.organization_id,
        role: active.role as ClientRole,
        name: active.organizations?.name ?? "Organization",
      },
      organizations: memberships.map((m) => ({
        id: m.organization_id,
        role: m.role as ClientRole,
        name: m.organizations?.name ?? "Organization",
      })),
      isStaff,
    };
  });

// ─── Canonical KPI service ──────────────────────────────────────────────────
// Definitions live in `@/lib/client-kpi.server` (loadKpiRows, computeKpis,
// isTopMatch, isInInterview). Everything below composes those primitives.

// ─── Overview ───────────────────────────────────────────────────────────────

export const getClientOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const rows = await loadKpiRows(context.supabase, data.orgId);

    const { data: positions } = await context.supabase
      .from("positions")
      .select("id, title, status, updated_at")
      .eq("organization_id", data.orgId)
      .in("status", ["active", "paused", "approved"])
      .order("updated_at", { ascending: false });
    const activePositionsList = (positions as AnyRow[]) ?? [];
    const activePositions = activePositionsList.length;
    const kpis = computeKpis(rows, activePositions);

    // "What's new" — matches delivered in the past 7 days.
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const new_this_week = rows.filter(
      (r) =>
        r.stage === "delivered" &&
        r.delivered_at != null &&
        new Date(r.delivered_at).getTime() >= sevenDaysAgo,
    ).length;

    // Action-required list — items requiring the client's attention.
    const positionsById = new Map<string, AnyRow>(activePositionsList.map((p) => [p.id, p]));
    const positionCounts = new Map<string, number>();
    for (const r of rows) {
      if (r.stage === "delivered") {
        positionCounts.set(r.position_id, (positionCounts.get(r.position_id) ?? 0) + 1);
      }
    }
    const action_required: Array<{ type: string; label: string; href: string; count?: number }> = [];
    for (const [pid, count] of positionCounts) {
      const p = positionsById.get(pid);
      action_required.push({
        type: "new_delivered",
        label: `${count} new candidate${count === 1 ? "" : "s"} to review for ${p?.title ?? "position"}`,
        href: `/client/positions/${pid}`,
        count,
      });
    }
    const offerCount = rows.filter((r) => r.stage === "offer").length;
    if (offerCount > 0) {
      action_required.push({
        type: "offer_pending",
        label: `${offerCount} offer${offerCount === 1 ? "" : "s"} awaiting response`,
        href: `/client/candidates?filter=interview`,
        count: offerCount,
      });
    }
    const interviewScheduledCount = rows.filter((r) => r.interview_scheduled).length;
    if (interviewScheduledCount > 0) {
      action_required.push({
        type: "interview_scheduled",
        label: `${interviewScheduledCount} interview${interviewScheduledCount === 1 ? "" : "s"} scheduled — leave feedback after`,
        href: `/client/candidates?filter=interview`,
        count: interviewScheduledCount,
      });
    }

    // "What happens next" — per-position next milestone, only active positions.
    const rowsByPosition = new Map<string, KpiRow[]>();
    for (const r of rows) {
      if (!rowsByPosition.has(r.position_id)) rowsByPosition.set(r.position_id, []);
      rowsByPosition.get(r.position_id)!.push(r);
    }
    const whats_next = activePositionsList.slice(0, 6).map((p) => {
      const posRows = rowsByPosition.get(p.id) ?? [];
      let next = "Awaiting first candidates";
      if (posRows.some((r) => r.stage === "offer")) next = "Offer response";
      else if (posRows.some((r) => r.interview_active || r.stage === "interview_process"))
        next = "Interview outcome";
      else if (posRows.some((r) => r.stage === "shortlisted")) next = "Send interview requests";
      else if (posRows.some((r) => r.stage === "delivered")) next = "Review new candidates";
      return {
        position_id: p.id as string,
        title: p.title as string,
        status: p.status as string,
        next,
        delivered_pending: posRows.filter((r) => r.stage === "delivered").length,
      };
    });

    // Latest delivered candidates (top 4 — kept concise).
    const { data: latestMatches } = await context.supabase
      .from("candidate_matches")
      .select(
        `id, stage, delivered_at, position_id,
         candidate_profiles(id, full_name, headline, location, availability, years_experience, summary),
         positions(id, title),
         score_runs:approved_score_run_id (score, fit_label, explanation, result, requirement_coverage, evidence)`,
      )
      .eq("organization_id", data.orgId)
      .eq("client_visibility", "visible")
      .order("delivered_at", { ascending: false })
      .limit(4);
    const latest_candidates = ((latestMatches as AnyRow[]) ?? []).map(toClientCandidateDTO);

    // Recent messages (last 3).
    const { data: recentMessages } = await context.supabase
      .from("messages")
      .select("id, body, created_at, sender_user_id, thread_id")
      .eq("thread_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(3);

    // "What changed" — filter to client-relevant events only (never internal
    // processing chatter). Whitelist the actions we surface.
    const CLIENT_RELEVANT_ACTIONS = [
      "candidate_match.stage_changed",
      "client.shortlist",
      "client.request_interview",
      "client.offer",
      "client.hire",
      "client.not_moving_forward",
      "client.submit_feedback",
      "position.approved",
      "position.activated",
      "position.paused",
    ];
    const { data: events } = await context.supabase
      .from("audit_events")
      .select("id, action, entity_type, created_at")
      .eq("organization_id", data.orgId)
      .in("action", CLIENT_RELEVANT_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(6);

    const lastEvent = (events as AnyRow[] | undefined)?.[0];
    const last_updated: string | null =
      lastEvent?.created_at ?? activePositionsList[0]?.updated_at ?? null;

    return {
      kpis,
      active_positions: activePositions,
      new_this_week,
      action_required,
      whats_next,
      latest_candidates,
      recent_messages: (recentMessages as AnyRow[]) ?? [],
      recent_activity: (events as AnyRow[]) ?? [],
      last_updated,
    };
  });



// ─── Positions ──────────────────────────────────────────────────────────────

export const getClientPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; status?: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        status: z.enum(["active", "draft", "paused", "closed"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const statusFilter = (
      data.status === "closed"
        ? (["closed", "archived"] as const)
        : data.status
          ? ([data.status] as const)
          : (["active", "draft", "paused", "closed", "archived"] as const)
    ) as unknown as string[];
    const { data: positions, error } = await context.supabase
      .from("positions")
      .select("id, title, status, location, work_model, employment_type, seniority, updated_at")
      .eq("organization_id", data.orgId)
      .in("status", statusFilter as never)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = await loadKpiRows(context.supabase, data.orgId);
    const byPosition = new Map<string, KpiRow[]>();
    for (const r of rows) {
      if (!byPosition.has(r.position_id)) byPosition.set(r.position_id, []);
      byPosition.get(r.position_id)!.push(r);
    }
    return (positions as AnyRow[]).map((p) => {
      const posRows = byPosition.get(p.id) ?? [];
      const kpi = computeKpis(posRows, 0);
      return {
        ...p,

        kpis: kpi,
        next_milestone: nextMilestoneFor(posRows, p.status),
        action_required: actionRequiredFor(posRows, p.status),
      };
    });
  });

function nextMilestoneFor(rows: KpiRow[], status: string): string | null {
  if (status === "draft") return "Awaiting intake approval";
  if (status === "paused") return "Position paused";
  if (status === "closed" || status === "archived") return null;
  if (rows.some((r) => r.stage === "offer")) return "Offer response";
  if (rows.some((r) => r.interview_active || r.stage === "interview_process"))
    return "Interview outcome";
  if (rows.some((r) => r.stage === "shortlisted")) return "Interview requests";
  if (rows.length > 0) return "Review new candidates";
  return "Awaiting first candidates";
}
function actionRequiredFor(rows: KpiRow[], _status: string): string | null {
  const newlyDelivered = rows.filter((r) => r.stage === "delivered").length;
  if (newlyDelivered > 0) return `${newlyDelivered} new to review`;
  return null;
}

export const getClientPositionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId: string }) =>
    z.object({ orgId: z.string().uuid(), positionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: position, error } = await context.supabase
      .from("positions")
      .select(
        "id, title, status, location, work_model, employment_type, seniority, description, requirements, preferred_requirements",
      )
      .eq("organization_id", data.orgId)
      .eq("id", data.positionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!position) return null;

    const { data: matches } = await context.supabase
      .from("candidate_matches")
      .select(
        `id, stage, admin_status, delivered_at, approved_score_run_id,
         candidate_profiles(id, full_name, headline, location),
         score_runs:approved_score_run_id (score, fit_label, explanation)`,
      )
      .eq("organization_id", data.orgId)
      .eq("position_id", data.positionId)
      .eq("client_visibility", "visible")
      .order("delivered_at", { ascending: false });

    return { position, matches: (matches as AnyRow[]) ?? [] };
  });

// ─── Candidates ─────────────────────────────────────────────────────────────

export type CandidateFilter =
  | "all"
  | "new"
  | "top"
  | "shortlisted"
  | "interview"
  | "hired"
  | "not_moving_forward";

export const getClientCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      filter?: CandidateFilter;
      positionId?: string;
      minScore?: number;
      fitBand?: string;
      location?: string;
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          filter: z
            .enum(["all", "new", "top", "shortlisted", "interview", "hired", "not_moving_forward"])
            .optional(),
          positionId: z.string().uuid().optional(),
          minScore: z.number().optional(),
          fitBand: z.string().optional(),
          location: z.string().optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("candidate_matches")
      .select(
        `id, stage, delivered_at, position_id, application_id,
         candidate_profiles(id, full_name, headline, location, timezone, availability, years_experience, summary, experience, skills, education, languages, work_authorization, linkedin_url, portfolio_url, certifications),
         positions(id, title),
         score_runs:approved_score_run_id (score, fit_label, explanation, result, requirement_coverage, evidence)`,
      )
      .eq("organization_id", data.orgId)
      .eq("client_visibility", "visible");


    if (data.positionId) q = q.eq("position_id", data.positionId);

    const { data: rows, error } = await q.order("delivered_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Map to sanitized client-safe DTOs first — filters below operate on those.
    let dtos = ((rows as AnyRow[]) ?? []).map(toClientCandidateDTO);

    if (data.filter && data.filter !== "all") {
      dtos = dtos.filter((d) => {
        if (data.filter === "new") return d.stage === "delivered";
        if (data.filter === "shortlisted") return d.stage === "shortlisted";
        if (data.filter === "hired") return d.stage === "hired";
        if (data.filter === "not_moving_forward")
          return d.stage === "not_moving_forward";
        if (data.filter === "interview")
          return d.stage === "interview_process" || d.stage === "offer";
        if (data.filter === "top")
          return (
            d.fit_label != null &&
            (TOP_FIT_LABELS as readonly string[]).includes(d.fit_label)
          );
        return true;
      });
    }
    if (data.minScore != null)
      dtos = dtos.filter((d) => (d.score ?? 0) >= data.minScore!);
    if (data.fitBand) dtos = dtos.filter((d) => d.fit_label === data.fitBand);
    if (data.location) {
      const needle = data.location.toLowerCase();
      dtos = dtos.filter((d) =>
        (d.candidate.location ?? "").toLowerCase().includes(needle),
      );
    }

    return dtos;
  });

export const getClientCandidate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string }) =>
    z.object({ orgId: z.string().uuid(), matchId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: match, error } = await context.supabase
      .from("candidate_matches")
      .select(
        `id, stage, delivered_at, position_id, application_id,
         candidate_profiles(id, full_name, headline, location, timezone, availability, years_experience, summary, experience, skills, education, languages, work_authorization, linkedin_url, portfolio_url, certifications),
         positions(id, title, location, work_model, requirements, preferred_requirements),
         score_runs:approved_score_run_id (score, fit_label, explanation, result, evidence, requirement_coverage)`,
      )
      .eq("organization_id", data.orgId)
      .eq("id", data.matchId)
      .eq("client_visibility", "visible")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!match) return null;

    const applicationId = (match as AnyRow).application_id;
    const [{ data: interviews }, { data: decisions }, answersRes] = await Promise.all([
      context.supabase
        .from("interviews")
        .select("id, status, requested_at, scheduled_at, completed_at, notes")
        .eq("candidate_match_id", data.matchId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("client_decisions")
        .select("id, decision, feedback, created_at")
        .eq("candidate_match_id", data.matchId)
        .order("created_at", { ascending: false }),
      applicationId
        ? context.supabase
            .from("application_answers")
            .select("id, answer, screening_questions(question, display_order)")
            .eq("application_id", applicationId)
        : Promise.resolve({ data: [] as AnyRow[] }),
    ]);

    const answers = ((answersRes as AnyRow).data as AnyRow[]) ?? [];
    answers.sort(
      (a, b) =>
        (a.screening_questions?.display_order ?? 0) -
        (b.screening_questions?.display_order ?? 0),
    );
    const matchWithAnswers = { ...(match as AnyRow), application_answers: answers };

    return {
      candidate: toClientCandidateDTO(matchWithAnswers),
      interviews: (interviews as AnyRow[]) ?? [],
      decisions: (decisions as AnyRow[]) ?? [],
    };
  });


// ─── Stage transitions ──────────────────────────────────────────────────────
//
// Backend validation: no matter where the transition originates (button, kanban
// drag, keyboard), it flows through this function and cannot bypass the graph.

// Canonical transition matrix — mirrored by client kanban STAGE_GRAPH.
const STAGE_GRAPH: Record<MatchStage, MatchStage[]> = {
  delivered: ["shortlisted", "interview_process", "not_moving_forward"],
  shortlisted: ["interview_process", "not_moving_forward"],
  interview_process: ["offer", "shortlisted", "not_moving_forward"],
  offer: ["hired", "not_moving_forward"],
  hired: [],
  not_moving_forward: ["shortlisted"],
};

/**
 * Reject if the caller is platform staff acting on an org where they hold no
 * active client-role membership AND no active interactive support session
 * exists for that org. Throws the typed `SUPPORT_VIEW_READ_ONLY` error the
 * spec requires; UI translates it to a friendly toast.
 */
async function assertNotSupportViewReadOnly(
  supabase: AnyRow,
  userId: string,
  orgId: string,
) {
  const { data: isClientEditor } = await supabase.rpc("is_org_editor", {
    _user: userId,
    _org: orgId,
  });
  if (isClientEditor === true) return;
  const { data: isStaff } = await supabase.rpc("is_platform_staff", {
    _user: userId,
  });
  if (isStaff !== true) throw new Error("forbidden");
  // Staff — allow only when an interactive support session is currently open.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: interactive } = await supabaseAdmin
    .from("support_sessions")
    .select("id")
    .eq("actor_user_id", userId)
    .eq("organization_id", orgId)
    .eq("mode", "interactive")
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (!interactive) throw new Error("SUPPORT_VIEW_READ_ONLY");
}

async function assertEditor(supabase: AnyRow, userId: string, orgId: string) {
  await assertNotSupportViewReadOnly(supabase, userId, orgId);
}

async function loadMatch(supabase: AnyRow, orgId: string, matchId: string) {
  const { data, error } = await supabase
    .from("candidate_matches")
    .select("id, stage, organization_id, position_id, candidate_profile_id, client_visibility")
    .eq("id", matchId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("match_not_found");
  if (data.client_visibility !== "visible") throw new Error("match_not_visible");
  return data as AnyRow;
}

async function writeAudit(
  supabase: AnyRow,
  opts: {
    actor: string;
    action: string;
    entity_type: string;
    entity_id: string;
    organization_id: string;
    before?: unknown;
    after?: unknown;
    trace_id: string;
  },
) {
  await supabase.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    organization_id: opts.organization_id,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
    trace_id: opts.trace_id,
  });
}

export const moveMatchStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string; toStage: MatchStage }) =>
    z
      .object({
        orgId: z.string().uuid(),
        matchId: z.string().uuid(),
        toStage: z.enum([
          "delivered",
          "shortlisted",
          "interview_process",
          "offer",
          "hired",
          "not_moving_forward",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const match = await loadMatch(context.supabase, data.orgId, data.matchId);
    const from = match.stage as MatchStage;
    if (from === data.toStage) return { ok: true, trace_id: trace };
    const allowed = STAGE_GRAPH[from] ?? [];
    if (!allowed.includes(data.toStage)) {
      throw new Error(`invalid_transition:${from}->${data.toStage}`);
    }
    const { error } = await context.supabase
      .from("candidate_matches")
      .update({ stage: data.toStage })
      .eq("id", data.matchId)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);

    // Canonical side-effects: mirror clientAction so any transition path
    // (button, drag, keyboard menu) produces identical decision + interview trails.
    const stageToDecision: Partial<Record<MatchStage, string>> = {
      shortlisted: "shortlist",
      interview_process: "request_interview",
      offer: "offer",
      hired: "hire",
      not_moving_forward: "not_moving_forward",
    };
    const decision = stageToDecision[data.toStage];
    if (decision) {
      await context.supabase.from("client_decisions").insert({
        candidate_match_id: data.matchId,
        organization_id: data.orgId,
        decision: decision as never,
        actor_user_id: context.userId,
      });
    }
    if (data.toStage === "interview_process" && from !== "interview_process") {
      await context.supabase.from("interviews").insert({
        candidate_match_id: data.matchId,
        organization_id: data.orgId,
        status: "requested",
        requested_at: new Date().toISOString(),
      });
    }

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "candidate_match.stage_changed",
      entity_type: "candidate_matches",
      entity_id: data.matchId,
      organization_id: data.orgId,
      before: { stage: from },
      after: { stage: data.toStage },
      trace_id: trace,
    });

    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      const stageToEvent: Partial<Record<MatchStage, "client_shortlisted" | "interview_requested" | "candidate_hired">> = {
        shortlisted: "client_shortlisted",
        interview_process: "interview_requested",
        hired: "candidate_hired",
      };
      const evt = stageToEvent[data.toStage];
      if (evt) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: staff } = await supabaseAdmin
          .from("memberships")
          .select("user_id")
          .in("role", ["platform_admin", "operations"])
          .eq("status", "active");
        const adminRecipients = (staff ?? []).map((s) => ({
          user_id: s.user_id as string,
          audience: "admin" as const,
          link_path: `/admin/candidates`,
        }));
        const { data: matchRow } = await supabaseAdmin
          .from("candidate_matches")
          .select("candidate_profile_id, application_id, position_id, candidate_profiles:candidate_profile_id(user_id)")
          .eq("id", data.matchId)
          .maybeSingle();
        const cpUser = (matchRow?.candidate_profiles as { user_id: string | null } | null)?.user_id ?? null;
        const candidateRecipients = cpUser
          ? [{ user_id: cpUser, audience: "candidate" as const, link_path: `/me/applications/${matchRow?.application_id ?? ""}` }]
          : [];
        await emitEventFromServer({
          event: evt,
          scope: `${data.matchId}:${data.toStage}`,
          organization_id: data.orgId,
          position_id: matchRow?.position_id ?? null,
          application_id: matchRow?.application_id ?? null,
          candidate_match_id: data.matchId,
          candidate_profile_id: matchRow?.candidate_profile_id ?? null,
          actor_user_id: context.userId,
          recipients: [...adminRecipients, ...candidateRecipients],
        });
      }
    } catch (emitErr) {
      console.error("[moveMatchStage] emit failed", trace, emitErr);
    }
    return { ok: true, trace_id: trace };
  });

// ─── Client actions ─────────────────────────────────────────────────────────

const ACTION_TO_STAGE: Partial<Record<string, MatchStage>> = {
  shortlist: "shortlisted",
  request_interview: "interview_process",
  offer: "offer",
  not_moving_forward: "not_moving_forward",
  hire: "hired",
};

export const clientAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      matchId: string;
      action:
        | "shortlist"
        | "request_interview"
        | "request_more_information"
        | "not_moving_forward"
        | "submit_feedback"
        | "offer"
        | "hire";
      feedback?: string;
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          matchId: z.string().uuid(),
          action: z.enum([
            "shortlist",
            "request_interview",
            "request_more_information",
            "not_moving_forward",
            "submit_feedback",
            "offer",
            "hire",
          ]),
          feedback: z.string().max(4000).optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const match = await loadMatch(context.supabase, data.orgId, data.matchId);

    const nextStage = ACTION_TO_STAGE[data.action];
    if (nextStage && match.stage !== nextStage) {
      const allowed = STAGE_GRAPH[match.stage as MatchStage] ?? [];
      if (!allowed.includes(nextStage)) {
        throw new Error(`invalid_transition:${match.stage}->${nextStage}`);
      }
      const { error } = await context.supabase
        .from("candidate_matches")
        .update({ stage: nextStage })
        .eq("id", data.matchId)
        .eq("organization_id", data.orgId);
      if (error) throw new Error(error.message);
    }

    if (data.action === "request_interview") {
      await context.supabase.from("interviews").insert({
        candidate_match_id: data.matchId,
        organization_id: data.orgId,
        status: "requested",
        requested_at: new Date().toISOString(),
      });
    }

    // Persist a decision that mirrors the client's intent.
    const decisionMap = {
      shortlist: "shortlist",
      request_interview: "request_interview",
      request_more_information: "request_information",
      not_moving_forward: "not_moving_forward",
      offer: "offer",
      hire: "hire",
    } as const;
    const decision = (decisionMap as Record<string, string>)[data.action] ?? null;
    if (decision) {
      await context.supabase.from("client_decisions").insert({
        candidate_match_id: data.matchId,
        organization_id: data.orgId,
        decision: decision as never,
        feedback: data.feedback ?? null,
        actor_user_id: context.userId,
      });
    }

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: `client.${data.action}`,
      entity_type: "candidate_matches",
      entity_id: data.matchId,
      organization_id: data.orgId,
      before: { stage: match.stage },
      after: { stage: nextStage ?? match.stage, feedback: data.feedback ?? null },
      trace_id: trace,
    });

    return { ok: true, trace_id: trace };
  });

// ─── Messages ───────────────────────────────────────────────────────────────
// Threads are org-scoped; we key them on the organization id itself so a client
// workspace has one persistent conversation with the TaaSFlow team.

export const getClientMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, sender_user_id, body, created_at, recipient_context")
      .eq("thread_id", data.orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows as AnyRow[]) ?? [];
  });

export const sendClientMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; body: string }) =>
    z.object({ orgId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    // Sender must be a real client member of the org, OR staff in an active
    // interactive support session. Read-only support view cannot send.
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    const { data: row, error } = await context.supabase
      .from("messages")
      .insert({
        thread_id: data.orgId,
        sender_user_id: context.userId,
        body: data.body,
        recipient_context: { org_id: data.orgId, thread_kind: "client_workspace" },
      })
      .select("id, sender_user_id, body, created_at, recipient_context")
      .single();
    if (error) throw new Error(error.message);
    return row as AnyRow;
  });

// ─── Team ───────────────────────────────────────────────────────────────────

export const getClientTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Only admins/editors of this org (or staff) can view the team.
    const { data: canRead } = await context.supabase.rpc("is_org_editor", {
      _user: context.userId,
      _org: data.orgId,
    });
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (canRead !== true && staff !== true) throw new Error("forbidden");
    const { data: rows, error } = await context.supabase
      .from("memberships")
      .select("user_id, role, status, created_at, profiles:user_id(full_name, email)")
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return (rows as AnyRow[]) ?? [];
  });
