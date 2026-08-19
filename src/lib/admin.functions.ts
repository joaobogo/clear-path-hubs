import { pilotEndsAt } from "@/lib/pilot-state";
// Admin dashboard service — canonical read + mutation server fns for Phase 7.
// Every mutation validates input, enforces staff, writes an audit event, and returns
// enough info for the caller to refresh its cache. Callers should use useMutation +
// queryClient.invalidateQueries; no button should only display a toast.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { EventType } from "./events";

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

export async function writeAudit(opts: {
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
  
  // P-017: Deduplicate identical audit writes within the same second to prevent churn.
  const now = new Date();
  const oneSecondAgo = new Date(now.getTime() - 1000).toISOString();
  
  const { data: existing } = await s
    .from("audit_events")
    .select("id")
    .eq("actor_user_id", opts.actor)
    .eq("action", opts.action)
    .eq("entity_type", opts.entity_type)
    .eq("entity_id", opts.entity_id)
    .gte("occurred_at", oneSecondAgo)
    .limit(1)
    .maybeSingle();

  if (existing) return;

  const { sanitizeInternalMarkers } = await import("./human-labels");

  const sanitizeState = (state: unknown) => {
    if (!state || typeof state !== "object") return state;
    const next = { ...state } as Record<string, unknown>;
    for (const [k, v] of Object.entries(next)) {
      if (typeof v === "string") next[k] = sanitizeInternalMarkers(v) ?? v;
    }
    return next;
  };

  await s.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    organization_id: opts.organization_id ?? null,
    before_state: (sanitizeState(opts.before) ?? null) as never,
    after_state: (sanitizeState(opts.after) ?? null) as never,
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

    const { resolveShowTestRecordsForUser, loadTestScope, excludeTestOrgs, excludeTestPositions } =
      await import("./admin-test-scope.server");
    const showTest = await resolveShowTestRecordsForUser(s, context.userId);
    const scope = await loadTestScope(s, showTest);

    const count = async (
      table: string,
      apply: (q: AnyRow) => AnyRow,
      opts?: { orgCol?: string; positionCol?: string; testFlag?: boolean },
    ): Promise<number> => {
      let q = apply(s.from(table).select("id", { count: "exact", head: true }));
      if (!showTest) {
        if (opts?.orgCol) q = excludeTestOrgs(q, scope, opts.orgCol);
        if (opts?.positionCol) q = excludeTestPositions(q, scope, opts.positionCol);
        if (opts?.testFlag) q = q.eq("is_test_record", false);
      }
      const { count: c } = await q;
      return c ?? 0;
    };

    const [
      new_intakes,
      positions_review,
      new_applications,
      candidates_review, // Awaiting decision (scored)
      candidates_ready,
      processing_failures,
      client_requests,
      aging,
      urgent_interviews,
      intake_inbox,
    ] = await Promise.all([
      // Fresh intake submissions (canonical source, not positions)
      count("intake_submissions", (q) => q.gte("created_at", weekAgo), {
        orgCol: "organization_id",
      }),
      // Submitted / needs-clarification — anything not yet approved
      count("positions", (q) => q.in("status", ["submitted", "needs_clarification"]), {
        orgCol: "organization_id",
        testFlag: true,
      }),
      // Applications landed in the pipeline in the last 24h
      count(
        "candidate_matches",
        (q) =>
          q
            .in("processing_state", ["queued", "parsing", "enriching", "ready_to_score", "parsed"])
            .gte("created_at", dayAgo),
        { testFlag: true },
      ),
      // Awaiting decision (scored)
      count(
        "candidate_matches",
        (q) => q.eq("admin_status", "pending").eq("processing_state", "scored"),
        { testFlag: true },
      ),
      // Approved but hidden — ready for the Publish Desk
      count(
        "candidate_matches",
        (q) => q.eq("admin_status", "approved").eq("client_visibility", "hidden"),
        { testFlag: true },
      ),
      // Email/message delivery failures to triage (7d canonical).
      // notification_deliveries has no direct org/position; the list is filtered in JS.
      count("notification_deliveries", (q) =>
        q.in("status", ["failed", "bounced", "suppressed"]).gte("created_at", weekAgo),
      ),
      // Client-initiated recompute / feedback in the last 7d.
      // score_decisions has no direct org/position; the list is filtered in JS.
      count("score_decisions", (q) =>
        q.eq("decision_type", "request_recompute").gte("created_at", weekAgo),
      ),
      // In-flight work older than 24h
      count(
        "candidate_matches",
        (q) =>
          q
            .in("processing_state", ["queued", "parsing", "enriching", "ready_to_score"])
            .lt("processing_updated_at", dayAgo),
        { testFlag: true },
      ),
      // Urgent interview activity: requested awaiting scheduling, or
      // scheduled within the next 48h.
      count(
        "interviews",
        (q) =>
          q.or(
            `status.eq.requested,and(status.eq.scheduled,scheduled_at.lte.${new Date(Date.now() + 48 * 3600_000).toISOString()})`,
          ),
        { orgCol: "organization_id", positionCol: "position_id" },
      ),
      // Intake submissions still needing platform action (not yet converted or resolved)
      count(
        "intake_submissions",
        (q) => q.is("position_id", null).not("status", "in", "(approved,rejected)"),
        { orgCol: "organization_id" },
      ),
    ]);

    // ── Detailed drill-through lists for each command-center section ──────
    const [
      { data: newIntakes },
      { data: positionsReview },
      { data: newApplications },
      { data: pendingReview },
      { data: readyPublish },
      { data: processingIssues },
      { data: clientRequests },
      { data: urgentInterviews },
      { data: intakeInbox },
      { data: recentActivity },
    ] = await Promise.all([
      s
        .from("intake_submissions")
        .select(
          "id,company_name,role_title,status,workspace_status,requisition_pending,created_at,position_id,organization_id",
        )
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(5)
        .then(async (res: { data: AnyRow[] | null; [key: string]: any }) => {
          if (showTest) return res;
          return {
            ...res,
            data: (res.data ?? []).filter((r: AnyRow) => !scope.orgIds.includes(r.organization_id)),
          };
        }),
      s
        .from("positions")
        .select("id,title,status,created_at,organization_id,is_test_record,organizations(name)")
        .in("status", ["submitted", "needs_clarification"])
        .eq("is_test_record", false)
        .order("created_at", { ascending: true })
        .limit(5)
        .then(async (res: { data: AnyRow[] | null; [key: string]: any }) => {
          if (showTest) return res;
          return {
            ...res,
            data: (res.data ?? []).filter((r: AnyRow) => !scope.orgIds.includes(r.organization_id)),
          };
        }),
      s
        .from("candidate_matches")
        .select(
          "id,created_at,processing_state,is_test_record,organization_id,position_id,candidate_profiles(full_name),positions(title,organizations(name))",
        )
        .in("processing_state", ["queued", "parsing", "enriching", "ready_to_score", "parsed"])
        .eq("is_test_record", false)
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false })
        .limit(5),
      s
        .from("candidate_matches")
        .select(
          "id,updated_at,is_test_record,organization_id,position_id,candidate_profiles(full_name),positions(title,organizations(name)),score_runs!candidate_matches_current_score_run_id_fkey(score,fit_label)",
        )
        .eq("processing_state", "scored")
        .eq("admin_status", "pending")
        .eq("is_test_record", false)
        .order("updated_at", { ascending: false })
        .limit(6),
      s
        .from("candidate_matches")
        .select(
          "id,updated_at,is_test_record,organization_id,position_id,candidate_profiles(full_name),positions(title,organizations(name))",
        )
        .eq("admin_status", "approved")
        .eq("client_visibility", "hidden")
        .eq("is_test_record", false)
        .order("updated_at", { ascending: false })
        .limit(5),
      s
        .from("notification_deliveries")
        .select(
          "id,status,error_message,updated_at,notifications(title,audience,recipient_user_id,organization_id)",
        )
        .in("status", ["failed", "bounced", "suppressed"])
        .gte("created_at", weekAgo)
        .order("updated_at", { ascending: false })
        .limit(6)
        .then(async (res: { data: AnyRow[] | null; [key: string]: any }) => {
          if (showTest) return res;
          return {
            ...res,
            data: (res.data ?? []).filter((r: AnyRow) => {
              const orgId = r.notifications?.organization_id as string | null;
              return !orgId || !scope.orgIds.includes(orgId);
            }),
          };
        }),
      s
        .from("score_decisions")
        .select(
          "id,decision_type,reason,created_at,candidate_match_id,candidate_matches!inner(organization_id, position_id, candidate_profiles(full_name),positions(title,organizations(name)))",
        )
        .eq("decision_type", "request_recompute")
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(5)
        .then(async (res: { data: AnyRow[] | null; [key: string]: any }) => {
          if (showTest) return res;
          return {
            ...res,
            data: (res.data ?? []).filter((r: AnyRow) => {
              const m = r.candidate_matches as AnyRow | null;
              if (!m) return true;
              return !scope.orgIds.includes(m.organization_id) && !scope.positionIds.includes(m.position_id);
            }),
          };
        }),
      s
        .from("interviews")
        .select(
          "id,status,scheduled_at,requested_at,organization_id,position_id,candidate_match_id,candidate_matches(candidate_profiles(full_name),positions(title,organizations(name)))",
        )
        .or(
          `status.eq.requested,and(status.eq.scheduled,scheduled_at.lte.${new Date(Date.now() + 48 * 3600_000).toISOString()})`,
        )
        .order("scheduled_at", { ascending: true, nullsFirst: true })
        .limit(6)
        .then(async (res: { data: AnyRow[] | null; [key: string]: any }) => {
          if (showTest) return res;
          return {
            ...res,
            data: (res.data ?? []).filter((r: AnyRow) => {
              return !scope.orgIds.includes(r.organization_id) && !scope.positionIds.includes(r.position_id);
            }),
          };
        }),
      s
        .from("intake_submissions")
        .select(
          "id,company_name,role_title,status,workspace_status,requisition_pending,created_at,position_id,organization_id",
        )
        .is("position_id", null)
        .not("status", "in", "(approved,rejected)")
        .order("created_at", { ascending: false })
        .limit(6)
        .then(async (res: { data: AnyRow[] | null; [key: string]: any }) => {
          if (showTest) return res;
          return {
            ...res,
            data: (res.data ?? []).filter((r: AnyRow) => !scope.orgIds.includes(r.organization_id)),
          };
        }),
      s
        .from("audit_events")
        .select("id,action,entity_type,entity_id,created_at,organization_id")
        .in("action", [
          "intake.submitted",
          "match.visibility.hidden",
          "master_admin_designated",
          "support.session_started",
          "organization.update",
          "INSERT",
          "UPDATE",
        ])
        .order("created_at", { ascending: false })
        .limit(10)
        .then(async (res: { data: AnyRow[] | null; [key: string]: any }) => {
          if (showTest) return res;
          return {
            ...res,
            data: (res.data ?? []).filter((r: AnyRow) => {
              return !r.organization_id || !scope.orgIds.includes(r.organization_id);
            }),
          };
        }),
    ]);

    return {
      new_intakes,
      positions_review,
      new_applications,
      candidates_review,
      candidates_ready,
      processing_failures,
      client_requests,
      aging,
      urgent_interviews,
      intake_inbox,
      lists: {
        new_intakes: (newIntakes ?? []) as AnyRow[],
        positions_review: (positionsReview ?? []) as AnyRow[],
        new_applications: (newApplications ?? []) as AnyRow[],
        candidates_pending_review: (pendingReview ?? []) as AnyRow[],
        candidates_ready_to_publish: (readyPublish ?? []) as AnyRow[],
        processing_issues: (processingIssues ?? []) as AnyRow[],
        client_requests: (clientRequests ?? []) as AnyRow[],
        urgent_interviews: (urgentInterviews ?? []) as AnyRow[],
        intake_inbox: (intakeInbox ?? []) as AnyRow[],
      },


      recent_activity: (recentActivity ?? []) as AnyRow[],
      generated_at: new Date().toISOString(),
    };
  });



// ─── Clients & Positions ─────────────────────────────────────────────────────

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        include_test: z.boolean().optional().default(false),
        status: z.enum(["active", "archived", "all"]).optional().default("active"),
        industry: z.string().optional(),
        sort: z
          .enum([
            "activity_desc",
            "updated_desc",
            "updated_asc",
            "name_asc",
            "name_desc",
            "status_asc",
            "candidates_desc",
            "positions_desc",
            "action_desc",
          ])
          .optional()
          .default("activity_desc"),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { resolveShowTestRecordsForUser, excludeTestFlag } = await import(
      "./admin-test-scope.server"
    );
    const showTest = await resolveShowTestRecordsForUser(s, context.userId);

    let q = s
      .from("organizations")
      .select(
        "id,name,status,domain,industry,updated_at,archived_at,onboarding_status,primary_contact_name,primary_contact_email,is_test_record,is_demo,is_qa,is_internal",
      );
    // P-020: Increase limit to ensure all organizations are captured before client-side filtering.
    // The previous 500 limit could cause missing results if there are many test/archived records.
    q = q.limit(2000);
    // C4: ensure organizations with active roles are always included in the active list.
    // P-020: if include_test is false, we filter them at the DB level to reduce payload.
    // If we're looking for a specific name, we widen the query to include test records
    // but the client-side still applies the user's global toggle.
    if (!data.include_test) {
      q = q.eq("is_test_record", false);
    }
    const { data: rows } = await q;

    const orgIds = (rows ?? []).map((r: AnyRow) => r.id);

    const stats: Record<
      string,
      {
        positions: number;
        active: number;
        candidates_delivered: number;
        last_activity_at: string | null;
        actions_required: number;
      }
    > = {};
    for (const id of orgIds) {
      stats[id] = {
        positions: 0,
        active: 0,
        candidates_delivered: 0,
        last_activity_at: null,
        actions_required: 0,
      };
    }

    if (orgIds.length) {
      const [{ data: pos }, { data: matches }, { data: activity }] = await Promise.all([
        s.from("positions").select("organization_id,status").in("organization_id", orgIds),
        s
          .from("candidate_matches")
          .select("organization_id,client_visibility,stage")
          .in("organization_id", orgIds),
        s
          .from("audit_events")
          .select("organization_id,created_at")
          .in("organization_id", orgIds)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      for (const p of (pos ?? []) as AnyRow[]) {
        const c = stats[p.organization_id];
        if (!c) continue;
        c.positions += 1;
        if (p.status === "active") c.active += 1;
        if (p.status === "review" || p.status === "pending_approval") c.actions_required += 1;
      }
      for (const m of (matches ?? []) as AnyRow[]) {
        const c = stats[m.organization_id];
        if (!c) continue;
        if (m.client_visibility === "visible") {
          c.candidates_delivered += 1;
          if (m.stage === "delivered") {
            c.actions_required += 1;
          }
        }
      }
      for (const a of (activity ?? []) as AnyRow[]) {
        const c = stats[a.organization_id];
        if (c && !c.last_activity_at) c.last_activity_at = a.created_at;
      }
    }

    const merged = (rows ?? []).map((r: AnyRow) => {
      const st = stats[r.id]!;
      return {
        ...r,
        positions_total: st.positions,
        positions_active: st.active,
        candidates_delivered: st.candidates_delivered,
        actions_required: st.actions_required,
        last_activity_at: st.last_activity_at ?? r.updated_at,
      };
    }).filter((r: AnyRow) => {
      const { status, industry } = data;
      if (industry && r.industry !== industry) return false;
      // C4: An organization is "active" if it is not archived OR it has active positions.
      if (status === "archived") return !!r.archived_at;
      if (status === "active") return !r.archived_at || r.positions_active > 0;
      return true;
    });

    const industrySet = new Set<string>();
    for (const r of (rows ?? []) as AnyRow[]) {
      if (r.industry) industrySet.add(String(r.industry));
    }
    const industries: string[] = Array.from(industrySet).sort();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmp = (a: any, b: any) => {
      switch (data.sort) {
        case "updated_asc":
          return String(a.updated_at).localeCompare(String(b.updated_at));
        case "updated_desc":
          return String(b.updated_at).localeCompare(String(a.updated_at));
        case "name_asc":
          return String(a.name).localeCompare(String(b.name));
        case "name_desc":
          return String(b.name).localeCompare(String(a.name));
        case "status_asc":
          return String(a.status).localeCompare(String(b.status));
        case "candidates_desc":
          return (b.candidates_delivered ?? 0) - (a.candidates_delivered ?? 0);
        case "positions_desc":
          return (b.positions_active ?? 0) - (a.positions_active ?? 0);
        case "action_desc":
          return (
            (b.actions_required ?? 0) - (a.actions_required ?? 0) ||
            String(b.last_activity_at ?? "").localeCompare(String(a.last_activity_at ?? ""))
          );
        case "activity_desc":
        default:
          return String(b.last_activity_at ?? "").localeCompare(String(a.last_activity_at ?? ""));
      }
    };
    merged.sort(cmp);

    const total = merged.length;
    // C5: active/archived counts derived from the table's own query to ensure consistency.
    const active_count = merged.filter((r: AnyRow) => !r.archived_at).length;
    const archived_count = merged.filter((r: AnyRow) => r.archived_at).length;
    const items = merged;

    return {
      items,
      total,
      active_count,
      archived_count,
      industries,
      test_records_hidden: !showTest,
    };
  });

export const restoreOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
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
    if (!before.archived_at) return { ok: true as const, organization: before, trace_id: trace };
    const now = new Date().toISOString();
    const { data: after, error } = await s
      .from("organizations")
      .update({ archived_at: null, status: "active", dashboard_status: "active", updated_at: now })
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`restore_failed:${error.message} [${trace}]`);
    await writeAudit({
      actor: context.userId,
      action: "organization.restore",
      entity_type: "organizations",
      entity_id: data.id,
      organization_id: data.id,
      before,
      after,
      trace_id: trace,
    });
    return { ok: true as const, organization: after, trace_id: trace };
  });




export const getClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    // NOTE: candidate_profiles has no FK to organizations, so the old embedded
    // `parsed_cv_count:candidate_profiles(count)` made PostgREST reject the whole
    // organization read (PGRST200) — which surfaced as "Organization not found"
    // for every client. Count candidates through candidate_matches instead.
    const [orgRes, membersRes, positionsRes, candidateCountRes] = await Promise.all([
      s.from("organizations").select("*, memberships(count)").eq("id", data.id).maybeSingle(),
      s
        .from("memberships")
        .select("id,role,status,created_at,profiles(auth_user_id,full_name,email)")
        .eq("organization_id", data.id)
        .in("role", ["client_admin", "client_editor", "client_viewer"])
        .neq("status", "removed")
        .order("created_at", { ascending: false }),
      s
        .from("positions")
        .select(
          "id,title,status,visibility,work_model,employment_type,seniority,location,updated_at,published_at,created_at",
        )
        .eq("organization_id", data.id)
        .order("updated_at", { ascending: false }),
      s
        .from("candidate_matches")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", data.id),
    ]);
    if (orgRes.error) throw new Error(orgRes.error.message);
    if (!orgRes.data) return null;
    return {
      organization: {
        ...(orgRes.data as AnyRow),
        parsed_cv_count: [{ count: candidateCountRes.count ?? 0 }],
      },
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
        organization_id: z.string().uuid().optional(),
        /** A staff user id, or "__unassigned__" for ownerless positions. */
        owner: z.string().min(1).optional(),
        location: z.string().optional(),

        sort: z
          .enum([
            "updated_desc",
            "updated_asc",
            "title_asc",
            "title_desc",
            "delivered_desc",
            "action_desc",
          ])
          .optional()
          .default("updated_desc"),
        page: z.number().int().min(1).max(200).optional().default(1),
        page_size: z.number().int().min(5).max(100).optional().default(25),
        /** Explicit per-request override of the "hide test/internal records" default. */
        include_test: z.boolean().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { resolveShowTestRecordsForUser, loadTestScope, excludeTestOrgs } = await import(
      "./admin-test-scope.server"
    );
    const showTest =
      data.include_test === true
        ? true
        : await resolveShowTestRecordsForUser(s, context.userId);
    const scope = await loadTestScope(s, showTest);


    // Base query with count for pagination.
    let base = s
      .from("positions")
      .select(
        "id,title,status,visibility,updated_at,location,organization_id,organizations(id,name)",
        { count: "exact" },
      );
    if (data.status) base = base.eq("status", data.status);
    if (data.organization_id) base = base.eq("organization_id", data.organization_id);
    if (data.owner === "__unassigned__") base = base.is("owner_user_id", null);
    else if (data.owner) base = base.eq("owner_user_id", data.owner);
    if (data.location) {
      const { ilikeValue } = await import("./search/postgrest-filter");
      const val = ilikeValue(data.location);
      if (val) base = base.ilike("location", val);
    }
    if (data.q) {
      const { buildPositionSearchOr } = await import("./search/postgrest-filter");
      const searchOr = await buildPositionSearchOr(s as never, data.q);
      if (searchOr) base = base.or(searchOr);
    }
    if (!showTest) {
      base = excludeTestOrgs(base, scope);
      base = base.or("is_test_record.is.null,is_test_record.eq.false");
    }



    // Sort — DB-side for updated/title; delivered/action sorts happen after enrichment.
    const sort = data.sort ?? "updated_desc";
    if (sort === "updated_desc") base = base.order("updated_at", { ascending: false });
    else if (sort === "updated_asc") base = base.order("updated_at", { ascending: true });
    else if (sort === "title_asc") base = base.order("title", { ascending: true });
    else if (sort === "title_desc") base = base.order("title", { ascending: false });
    else base = base.order("updated_at", { ascending: false });

    const isPostFilterSort = sort === "delivered_desc" || sort === "action_desc";

    // For post-enrichment sorts we widen the fetch window so the top-N stays stable.
    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;
    if (!isPostFilterSort) base = base.range(from, to);
    else base = base.range(0, Math.min(299, from + data.page_size * 4 - 1));

    const { data: rows, count, error: listError } = await base;
    if (listError) throw new Error(`positions_list_failed: ${listError.message}`);
    const positions = (rows ?? []) as AnyRow[];

    // How many rows the same filters would return with test/internal records
    // included — so the UI can say "N hidden" instead of silently truncating.
    let unfilteredTotal = count ?? positions.length;
    if (!showTest) {
      let all = s.from("positions").select("id", { count: "exact", head: true });
      if (data.status) all = all.eq("status", data.status);
      if (data.organization_id) all = all.eq("organization_id", data.organization_id);
      if (data.owner === "__unassigned__") all = all.is("owner_user_id", null);
      else if (data.owner) all = all.eq("owner_user_id", data.owner);
      if (data.location) {
        const { ilikeValue } = await import("./search/postgrest-filter");
        const val = ilikeValue(data.location);
        if (val) all = all.ilike("location", val);
      }
      if (data.q) {
        const { buildPositionSearchOr } = await import("./search/postgrest-filter");
        const searchOr = await buildPositionSearchOr(s as never, data.q);
        if (searchOr) all = all.or(searchOr);
      }
      const { count: allCount } = await all;
      unfilteredTotal = allCount ?? unfilteredTotal;
    }


    // Enrich each position with pipeline counts + action-required count.
    const ids = positions.map((p) => p.id);
    let counts: Record<
      string,
      { delivered: number; shortlisted: number; interviews: number; action_required: number }
    > = {};
    if (ids.length > 0) {
      const { data: matchRows } = await s
        .from("candidate_matches")
        .select("position_id,stage,admin_status,client_visibility,processing_state")
        .in("position_id", ids);
      const m = (matchRows ?? []) as AnyRow[];
      for (const id of ids) {
        counts[id] = { delivered: 0, shortlisted: 0, interviews: 0, action_required: 0 };
      }
      for (const r of m) {
        const c = counts[r.position_id];
        if (!c) continue;
        if (r.client_visibility === "visible") c.delivered += 1;
        if (r.stage === "shortlisted") c.shortlisted += 1;
        if (r.stage === "interview_process") c.interviews += 1;
        // "Action required" = scored+approved but not yet published, or manual review, or failed processing.
        const needsAdmin =
          (r.processing_state === "scored" && r.admin_status === "pending") ||
          r.processing_state === "manual_review_required" ||
          ["failed", "provider_blocked", "ocr_required"].includes(r.processing_state);
        const needsPublish =
          r.processing_state === "scored" &&
          r.admin_status === "approved" &&
          r.client_visibility !== "visible";
        if (needsAdmin || needsPublish) c.action_required += 1;
      }
    }

    let enriched = positions.map((p) => ({
      ...p,
      counts: counts[p.id] ?? { delivered: 0, shortlisted: 0, interviews: 0, action_required: 0 },
    }));

    if (isPostFilterSort) {
      const key = sort === "delivered_desc" ? "delivered" : "action_required";
      enriched.sort(
        (a, b) => (b.counts[key] ?? 0) - (a.counts[key] ?? 0) ||
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      enriched = enriched.slice(from, from + data.page_size);
    }

    const total = count ?? enriched.length;
    return {
      rows: enriched as AnyRow[],
      total,
      page: data.page,
      page_size: data.page_size,
      include_test: showTest,
      hidden_test: Math.max(0, unfilteredTotal - total),
    };

  });

export const listPositionFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const [orgsRes, locsRes] = await Promise.all([
      s
        .from("organizations")
        .select("id,name")
        .order("name", { ascending: true })
        .limit(500),
      s
        .from("positions")
        .select("location")
        .not("location", "is", null)
        .limit(500),
    ]);
    const locations = Array.from(
      new Set(((locsRes.data ?? []) as AnyRow[]).map((r) => String(r.location ?? "").trim()).filter(Boolean)),
    ).sort();
    return {
      clients: (orgsRes.data ?? []) as AnyRow[],
      locations,
    };
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
      department: z.string().max(200).nullable().optional(),
      work_model: z.enum(["remote", "hybrid", "onsite"]).nullable().optional(),
      employment_type: z
        .enum(["full_time", "part_time", "contract", "temporary", "internship"])
        .nullable()
        .optional(),
      seniority: z.string().max(60).nullable().optional(),
      requirements: z.array(z.unknown()).optional(),
      preferred_requirements: z.array(z.unknown()).optional(),
      dealbreakers: z.array(z.unknown()).optional(),
      compensation: z.record(z.string(), z.unknown()).optional(),
      work_authorization: z.record(z.string(), z.unknown()).optional(),
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
    // One source event per meaningful change. The scope hashes the patch so a
    // double-click (identical payload) collapses into a single event row.
    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      await emitEventFromServer({
        event: "position_updated" as EventType,
        scope: `${data.id}:updated:${stableHash(data.patch)}`,
        organization_id: before.organization_id,
        position_id: data.id,
        // Actor is server-derived from the authenticated session, never from the request payload.
        actor_user_id: context.userId,
        link_path: `/client/positions/${data.id}`,
        payload: { fields: Object.keys(data.patch ?? {}) },
      });
    } catch (e) {
      console.error("[updatePosition] emit failed", trace_id, e);
    }
    return { ok: true as const, trace_id, position: after };
  });

/** Deterministic short hash used to build idempotent event scopes. */
function stableHash(value: unknown): string {
  const json = JSON.stringify(value ?? null);
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const statusTransition = z.object({
  id: z.string().uuid(),
  action: z.enum([
    "submit",
    "start_review",
    "request_clarification",
    "approve",
    "activate",
    "pause",
    "mark_filled",
    "close",
    "reopen",
    "archive",
  ]),
  reason: z.string().max(500).optional(),
});

const STATUS_MAP: Record<string, string> = {
  submit: "submitted",
  start_review: "under_review",
  request_clarification: "needs_clarification",
  approve: "approved",
  activate: "active",
  pause: "paused",
  mark_filled: "filled",
  close: "closed",
  reopen: "active",
  archive: "archived",
};


export const setPositionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => statusTransition.parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    // A clarification request the client can see must carry the question.
    if (data.action === "request_clarification" && !(data.reason ?? "").trim()) {
      throw new Error("Write the question before sending a clarification request.");
    }
    const trace_id = traceId();
    const s = await getAdmin();
    const { data: before } = await s
      .from("positions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("position_not_found");

    // Pilot scope: a company on the one-time pilot runs exactly one active role.
    // Paying clients (org.status = "active") and admin overrides are unaffected.
    if (data.action === "activate" || data.action === "reopen") {
      const { data: pilotOrg } = await s
        .from("organizations")
        .select("id, status, pilot_status, pilot_position_id, pilot_admin_override")
        .eq("id", before.organization_id)
        .maybeSingle();
      const onPilotOnly =
        pilotOrg &&
        pilotOrg.status !== "active" &&
        !pilotOrg.pilot_admin_override &&
        ["reserved", "active"].includes(pilotOrg.pilot_status ?? "");
      if (onPilotOnly) {
        if (pilotOrg!.pilot_position_id && pilotOrg!.pilot_position_id !== data.id) {
          throw new Error(
            "pilot_role_limit: this company's pilot covers a different role. Convert them to a paid plan or set an admin override first.",
          );
        }
        const { count } = await s
          .from("positions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", before.organization_id)
          .eq("status", "active")
          .neq("id", data.id);
        if ((count ?? 0) > 0) {
          throw new Error(
            "pilot_role_limit: this company already has an active pilot role. Pause it, convert to a paid plan, or set an admin override.",
          );
        }
      }
    }

    // Publish gate: the queue on /admin/positions and /admin/publish reads the
    // exact same check, so the list can never disagree with the action.
    if (data.action === "activate" || data.action === "reopen") {
      const { assertPositionPublishable } = await import("./publish-gate.server");
      await assertPositionPublishable(s, data.id);
    }

    // A role cannot be closed as filled without a confirmed hire record —
    // otherwise placement data goes missing the moment the role closes.
    if (data.action === "mark_filled") {
      const { positionHasConfirmedHire } = await import("./offer-hire.server");
      const { CLOSE_FILLED_BLOCKED } = await import("./offer-hire");
      if (!(await positionHasConfirmedHire(s as never, data.id))) {
        throw new Error(CLOSE_FILLED_BLOCKED);
      }
    }

    const next = STATUS_MAP[data.action];

    const patch: AnyRow = { status: next };

    if (data.action === "submit") patch.submitted_at = new Date().toISOString();
    if (data.action === "approve") patch.approved_at = new Date().toISOString();
    if (data.action === "activate" || data.action === "reopen") patch.published_at = new Date().toISOString();
    if (data.action === "close" || data.action === "mark_filled") patch.closed_at = new Date().toISOString();
    if (data.action === "archive") patch.closed_at = before.closed_at ?? new Date().toISOString();
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
      after: { ...(after ?? {}), reason: data.reason ?? null },
      trace_id,
    });
    // One source event per meaningful change.
    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      const EVENT_MAP: Record<string, EventType> = {
        submit: "intake_submitted",
        approve: "position_approved",
        activate: "position_activated",
        reopen: "position_reopened",
        pause: "position_paused",
        mark_filled: "position_filled",
        close: "position_closed",
        request_clarification: "clarification_requested",
      };
      const event = EVENT_MAP[data.action];
      if (event) {
        await emitEventFromServer({
          event,
          scope: `${data.id}:${data.action}:${new Date().getTime()}`,
          organization_id: before.organization_id,
          position_id: data.id,
          actor_user_id: context.userId,
          link_path: `/admin/positions/${data.id}`,
          payload: { reason: data.reason ?? null },
        });
      }
    } catch (e) {
      console.error("[setPositionStatus] activity emit failed", trace_id, e);
    }
    // Emit lifecycle events so Client + Admin dashboards refresh in real time.
    const eventMap: Record<string, string> = {
      activate: "position_activated",
      reopen: "position_reopened",
      approve: "position_approved",
      close: "position_closed",
      mark_filled: "position_filled",
      pause: "position_paused",
      request_clarification: "clarification_requested",
    };
    if (eventMap[data.action]) {
      try {
        const { emitEventFromServer } = await import("./notifications.functions");
        await emitEventFromServer({
          event: eventMap[data.action] as EventType,
          scope: `${data.id}:${data.action}`,
          organization_id: before.organization_id,
          position_id: data.id,
          // Actor is server-derived from the authenticated session, never from the request payload.
          actor_user_id: context.userId,
          link_path: `/client/positions/${data.id}`,
          payload: { title: before.title ?? null, note: data.reason ?? null },
        });
      } catch (e) {
        console.error("[setPositionStatus] emit failed", trace_id, e);
      }
    }
    // Start the 14-day pilot clock at activation — never at signup.
    if (data.action === "activate" || data.action === "reopen") {
      try {
        const { data: org } = await s
          .from("organizations")
          .select("id, pilot_status, pilot_position_id, pilot_started_at")
          .eq("id", before.organization_id)
          .maybeSingle();
        if (org && org.pilot_position_id === data.id && !org.pilot_started_at) {
          const startedAt = new Date();
          const endsAt = pilotEndsAt(startedAt);

          await s
            .from("organizations")
            .update({
              pilot_status: "active",
              pilot_started_at: startedAt.toISOString(),
              pilot_ends_at: endsAt.toISOString(),
            })
            .eq("id", org.id);
        }
      } catch (e) {
        console.error("[setPositionStatus] pilot clock failed", trace_id, e);
      }
    }
    // The search is genuinely live now — tell the client once.
    if (data.action === "activate" || data.action === "reopen") {
      try {
        const { notifySearchLive } = await import("./search-live.server");
        await notifySearchLive(data.id);
      } catch (e) {
        console.error("[setPositionStatus] search-live email failed", trace_id, e);
      }
    }
    return { ok: true as const, trace_id, position: after };

  });

// Staff-created role. Intake is still the primary path; this exists so ops can
// open a role on a client's behalf (phone/email intake) without asking the
// client to fill the wizard. It creates a DRAFT only — the same publish gate
// applies before it can reach the job board.
export const createPositionForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        title: z.string().trim().min(2).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const trace_id = traceId();
    const s = await getAdmin();
    const { data: org } = await s
      .from("organizations")
      .select("id,name")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (!org) throw new Error("organization_not_found");
    const { data: created, error } = await s
      .from("positions")
      .insert({
        organization_id: data.organization_id,
        title: data.title,
        status: "draft",
        visibility: "private",
        created_by: context.userId,
      })
      .select("id,title,status,organization_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit({
      actor: context.userId,
      action: "position.create",
      entity_type: "position",
      entity_id: created.id,
      organization_id: data.organization_id,
      after: created,
      trace_id,
    });
    return { ok: true as const, trace_id, position: created };
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

// Permanently purges a position and every dependent row (candidate matches,
// applications, scoring runs, evidence, interviews, tasks, notifications,
// screening questions, rubric versions, memory, audit traces, etc.).
export const deletePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const trace_id = traceId();
    const s = await getAdmin();
    const { data: before } = await s
      .from("positions")
      .select("id,organization_id,title")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) throw new Error("position_not_found");
    const { data: deleted, error } = await s.rpc("hard_delete_position", {
      _position_id: data.id,
      // Actor is server-derived from the authenticated session, never from the request payload.
      _actor_user_id: context.userId,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(`delete_failed:${error.message}`);
    await writeAudit({
      actor: context.userId,
      action: "position.hard_delete",
      entity_type: "position",
      entity_id: data.id,
      organization_id: before.organization_id,
      before,
      after: deleted,
      trace_id,
    });
    return { ok: true as const, trace_id, deleted };
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
// `getClientPreview` selects, then passes through `toClientCandidateDTO`.
export const getClientPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin
      .from("candidate_matches")
      .select(
        `id, stage, delivered_at, position_id, application_id, candidate_profile_id, contact_released_at, contact_released_by, contact_release_reason,
         canonical_state, processing_state, processing_updated_at, submitted_to_client_at,
         score_stale, score_stale_reasons, score_stale_at, rescore_queued_at,
         candidate_profiles(id, full_name, headline, location, timezone, availability, years_experience, summary, experience, skills, education, languages, work_authorization, linkedin_url, portfolio_url, certifications, compensation_preferences, updated_at),
         positions(id, title, location, work_model, requirements, preferred_requirements, compensation, updated_at),
         applications(id, source, applied_at, created_at),
         score_runs:approved_score_run_id (score, fit_label, fit_band, result, evidence, requirement_coverage, completed_at, engine_version, evaluation_method, input_hash, blueprint_version, contradiction_status, must_have_coverage, preferred_coverage)`,
      )
      .eq("id", data.match_id)
      .maybeSingle();
    if (!m) return null;

    const applicationId = (m as AnyRow).application_id;
    const [hydratedMatch] = await (
      await import("@/lib/client-candidate-hydrate.server")
    ).hydrateClientCandidateProfiles([m as AnyRow]);

    const [interviewsRes, decisionsRes, answersRes, evidenceRes] = await Promise.all([
      supabaseAdmin
        .from("interviews")
        .select("id, status, requested_at, scheduled_at, completed_at, notes")
        .eq("candidate_match_id", data.match_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("client_decisions")
        .select("id, decision, feedback, created_at")
        .eq("candidate_match_id", data.match_id)
        .order("created_at", { ascending: false }),
      applicationId
        ? supabaseAdmin
            .from("application_answers")
            .select("id, answer, screening_questions(question, display_order)")
            .eq("application_id", applicationId)
        : Promise.resolve({ data: [] as AnyRow[] }),
      import("./client-kpi.server").then((m) =>
        m.loadClientEvidenceItems(supabaseAdmin, [data.match_id]),
      ),
    ]);

    const answers = ((answersRes as AnyRow).data as AnyRow[]) ?? [];
    answers.sort(
      (a, b) =>
        (a.screening_questions?.display_order ?? 0) - (b.screening_questions?.display_order ?? 0),
    );

    const ACTIVE_INTERVIEW_STATUSES = ["requested", "scheduling", "scheduled", "completed"];
    const matchWithAnswers = {
      ...hydratedMatch,
      interview_active: ((interviewsRes.data as AnyRow[]) ?? []).some((iv) =>
        ACTIVE_INTERVIEW_STATUSES.includes(String(iv.status)),
      ),
      evidence_items: evidenceRes.get(data.match_id) ?? [],
      application_answers: answers,
      audit_events: [], // Admin preview doesn't need full audit list
    };

    const { toClientCandidateDTO } = await import("@/lib/client-kpi.server");
    return {
      candidate: toClientCandidateDTO(matchWithAnswers as AnyRow),
      interviews: (interviewsRes.data as AnyRow[]) ?? [],
      decisions: (decisionsRes.data as AnyRow[]) ?? [],
    };
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

    // Jobs in trouble. This must match the "Processing exceptions" bucket on the
    // same page: failed jobs plus jobs still queued or running past the stale
    // cutoff. The previous filter used a status value the database does not have
    // ("stuck_queued"), so the query errored and the section reported "0" beside
    // a bucket showing dozens of rows.
    const { data: failedJobs, error: failedJobsError } = await s
      .from("processing_jobs")
      .select("id,job_type,status,attempts,error_code,error_message,trace_id,created_at,started_at,entity_id")
      .or(`status.eq.failed,and(status.in.(queued,running),created_at.lt.${staleCutoff})`)
      .order("created_at", { ascending: false })
      .limit(100);
    // A failed query is an error, not "no failures".
    if (failedJobsError) throw new Error(failedJobsError.message);


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

// ─── Admin messages inbox — every org thread visible to platform staff ──────
export const listAdminMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    // Latest message per thread (thread_id = organization_id in the current model).
    const { data: latest } = await s
      .from("messages")
      .select("id,thread_id,sender_user_id,body,created_at,read_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const byThread = new Map<string, AnyRow>();
    for (const m of (latest ?? []) as AnyRow[]) {
      if (!byThread.has(m.thread_id)) byThread.set(m.thread_id, m);
    }
    const threadIds = Array.from(byThread.keys());
    if (threadIds.length === 0) return { threads: [] as AnyRow[] };
    const { data: orgs } = await s
      .from("organizations")
      .select("id,name")
      .in("id", threadIds);
    const orgMap = new Map((orgs ?? []).map((o: AnyRow) => [o.id, o]));
    const threads = threadIds
      .map((tid) => {
        const m = byThread.get(tid) as AnyRow;
        const org = orgMap.get(tid) as AnyRow | undefined;
        return {
          thread_id: tid,
          organization: org ? { id: org.id, name: org.name } : null,
          last_body: m.body as string,
          last_at: m.created_at as string,
          unread: !m.read_at,
        };
      })
      .sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
    return { threads };
  });

/**
 * Candidate support requests. These have no organisation and no conversation —
 * the thread id is the candidate's own user id — so they never show up in the
 * client conversation list and need their own ops queue.
 */
export const listCandidateSupportRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: rows } = await s
      .from("messages")
      .select("id,thread_id,sender_user_id,body,created_at,read_at,recipient_context")
      .is("conversation_id", null)
      .contains("recipient_context", { audience: "taasflow_ops" })
      .order("created_at", { ascending: false })
      .limit(200);

    const messages = ((rows ?? []) as AnyRow[]).filter((m) => m.sender_user_id === m.thread_id);
    if (messages.length === 0) return { items: [] as AnyRow[] };

    const userIds = Array.from(new Set(messages.map((m) => m.thread_id)));
    const { data: profiles } = await s
      .from("candidate_profiles")
      .select("user_id,full_name,email")
      .in("user_id", userIds);
    const byUser = new Map((profiles ?? []).map((p: AnyRow) => [p.user_id, p]));

    const items = messages.map((m) => {
      const ctx = (m.recipient_context ?? {}) as AnyRow;
      const p = byUser.get(m.thread_id) as AnyRow | undefined;
      return {
        id: m.id as string,
        candidate_user_id: m.thread_id as string,
        candidate_name: (p?.full_name as string | undefined) ?? "Candidate",
        candidate_email: (p?.email as string | undefined) ?? null,
        kind: (ctx.kind as string | undefined) ?? "message",
        category: (ctx.category as string | undefined) ?? null,
        reference: (ctx.reference as string | undefined) ?? null,
        body: m.body as string,
        created_at: m.created_at as string,
        unread: !m.read_at,
      };
    });
    return { items };
  });

/**
 * The candidate side of a support thread, read by staff. The thread id is the
 * candidate's own user id; both directions live in the same thread so staff see
 * their own replies inline.
 */
export const getCandidateSupportThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ candidate_user_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: rows, error } = await s
      .from("messages")
      .select("id,sender_user_id,body,created_at,read_at")
      .eq("thread_id", data.candidate_user_id)
      .is("conversation_id", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      messages: ((rows ?? []) as AnyRow[]).map((m) => ({
        id: m.id as string,
        body: m.body as string,
        created_at: m.created_at as string,
        from_candidate: m.sender_user_id === data.candidate_user_id,
      })),
    };
  });

/**
 * Staff reply into a candidate support thread. Until this existed the channel
 * was one-way: candidates could write in and staff could only answer by email,
 * so the candidate's own Messages page never showed an answer.
 */
export const replyToCandidateSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        candidate_user_id: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const trace_id = traceId();
    const s = await getAdmin();

    // Only reply to someone who really is a candidate on this platform.
    const { data: profile } = await s
      .from("candidate_profiles")
      .select("id,user_id")
      .eq("user_id", data.candidate_user_id)
      .maybeSingle();
    if (!profile) throw new Error("candidate_not_found");

    const { data: row, error } = await s
      .from("messages")
      .insert({
        thread_id: data.candidate_user_id,
        sender_user_id: context.userId,
        body: data.body,
        recipient_context: { audience: "candidate", from: "taasflow_ops" },
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Answering clears the "New" badge on the ops queue for this candidate.
    await s
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("thread_id", data.candidate_user_id)
      .eq("sender_user_id", data.candidate_user_id)
      .is("read_at", null);

    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      await emitEventFromServer({
        event: "message_sent",
        scope: `candidate-reply:${(row?.id as string | undefined) ?? data.candidate_user_id}`,
        actor_user_id: context.userId,
        candidate_profile_id: (profile.id as string) ?? null,
        recipients: [
          {
            user_id: data.candidate_user_id,
            audience: "candidate",
            link_path: "/me/messages",
          },
        ],
        link_path: "/me/messages",
      });
    } catch (e) {
      console.error("[replyToCandidateSupport] notify failed", e);
    }

    await writeAudit({
      actor: context.userId,
      action: "candidate.support.replied",
      entity_type: "candidate_profile",
      entity_id: profile.id as string,
      trace_id,
    });

    return { ok: true as const, trace_id };
  });


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
    const releasePatch =
      data.visibility === "visible" && before.client_visibility !== "visible"
        ? {
            contact_released_at: new Date().toISOString(),
            contact_released_by: context.userId,
            contact_release_reason: "Released automatically at publish to client",
          }
        : {};
    const { data: after, error } = await s
      .from("candidate_matches")
      .update({ client_visibility: data.visibility, ...releasePatch })
      .eq("id", data.match_id)
      .select("id,client_visibility,contact_released_at,contact_released_by,contact_release_reason")
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
    // Emit candidate_published when a match becomes visible to the client.
    if (data.visibility === "visible" && before.client_visibility !== "visible") {
      try {
        const { data: full } = await s
          .from("candidate_matches")
          .select(
            "candidate_profile_id, application_id, position_id, organization_id, candidate_profiles:candidate_profile_id(user_id, full_name)",
          )
          .eq("id", data.match_id)
          .maybeSingle();
        const cpUser = (full?.candidate_profiles as { user_id: string | null } | null)?.user_id ?? null;
        const candidateRecipients = cpUser
          ? [{
              user_id: cpUser,
              audience: "candidate" as const,
              link_path: `/me/applications/${full?.application_id ?? ""}`,
            }]
          : [];
        const { emitEventFromServer } = await import("./notifications.functions");
        await emitEventFromServer({
          event: "candidate_published",
          scope: `${data.match_id}:published`,
          organization_id: before.organization_id,
          position_id: full?.position_id ?? null,
          application_id: full?.application_id ?? null,
          candidate_match_id: data.match_id,
          candidate_profile_id: full?.candidate_profile_id ?? null,
          // Actor is server-derived from the authenticated session, never from the request payload.
          actor_user_id: context.userId,
          link_path: `/client/candidates/${data.match_id}`,
          // Client recipients auto-fanout; append candidate recipient explicitly.
          recipients: candidateRecipients.length ? undefined : undefined,
          payload: {
            candidate_name:
              (full?.candidate_profiles as { full_name: string | null } | null)?.full_name ?? null,
          },
        });
        // Explicit candidate delivery (auto-fanout only reaches org members).
        if (candidateRecipients.length) {
          await emitEventFromServer({
            event: "candidate_published",
            scope: `${data.match_id}:published:candidate`,
            organization_id: before.organization_id,
            position_id: full?.position_id ?? null,
            application_id: full?.application_id ?? null,
            candidate_match_id: data.match_id,
            candidate_profile_id: full?.candidate_profile_id ?? null,
            // Actor is server-derived from the authenticated session, never from the request payload.
            actor_user_id: context.userId,
            recipients: candidateRecipients,
          });
        }
      } catch (e) {
        console.error("[setMatchClientVisibility] emit failed", trace_id, e);
      }
    }
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
    const { resolveShowTestRecordsForUser, excludeTestFlag } = await import(
      "./admin-test-scope.server"
    );
    const showTest = await resolveShowTestRecordsForUser(s, context.userId);

    let q = s
      .from("organizations")
      .select("id,name")
      .order("name", { ascending: true })
      .limit(500);
    if (!showTest) q = excludeTestFlag(q);

    const { data } = await q;
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
    const { resolveShowTestRecordsForUser, loadTestScope, excludeTestOrgs, excludeTestPositions } =
      await import("./admin-test-scope.server");
    const showTest = await resolveShowTestRecordsForUser(s, context.userId);
    const scope = await loadTestScope(s, showTest);

    let q = s
      .from("positions")
      .select("id,title,organization_id,organizations(name)")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    if (!showTest) {
      q = excludeTestOrgs(q, scope);
      q = excludeTestPositions(q, scope);
    }

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
            is_test_record: z.boolean().optional(),
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
      .update({ archived_at: now, status: "archived", dashboard_status: "inactive", updated_at: now })
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
    // Reconcile client details (C10): Unified audit view
    const { data: rows } = await s
      .from("audit_events")
      .select("id,action,entity_type,entity_id,created_at,actor_user_id,trace_id,payload")
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
        "id,stage,processing_state,recommendation,canonical_state,admin_status,client_visibility,updated_at,candidate_profiles(id,full_name,email),positions(id,title),score_runs:approved_score_run_id(score,fit_label,fit_band)",
      )
      .eq("organization_id", data.id)
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    return (rows ?? []) as AnyRow[];
  });

export const getClientDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).optional().default(100),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    // Documents attached to candidates matched to any position in this org
    const { data: matches } = await s
      .from("candidate_matches")
      .select("candidate_profile_id")
      .eq("organization_id", data.id);
    const profileIds = Array.from(
      new Set(((matches ?? []) as AnyRow[]).map((m) => m.candidate_profile_id).filter(Boolean)),
    );
    if (profileIds.length === 0) return [] as AnyRow[];
    const { data: files } = await s
      .from("files")
      .select(
        "id,filename,mime_type,size,file_status,created_at,candidate_profile_id,candidate_profiles(id,full_name)",
      )
      .in("candidate_profile_id", profileIds)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return (files ?? []) as AnyRow[];
  });

export const updateClientNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        internal_notes: z.string().max(20000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { error } = await s
      .from("organizations")
      .update({ internal_notes: data.internal_notes, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, trace_id: crypto.randomUUID() };
  });

// ─── Position workspace: screening + activity ────────────────────────────────

const screeningItem = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(3).max(600),
  answer_type: z
    .enum(["text", "long_text", "number", "boolean", "single_choice", "multi_choice", "date", "file"])
    .default("text"),
  required: z.boolean().default(false),
  dealbreaker: z.boolean().default(false),
  scoring_weight: z.number().min(0).max(10).default(1),
  display_order: z.number().int().min(0).default(0),
  preferred_answer: z.unknown().optional(),
  options: z.unknown().optional(),
});

const saveScreeningInput = z.object({
  position_id: z.string().uuid(),
  questions: z.array(screeningItem).max(30),
});

export const saveScreeningQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => saveScreeningInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const trace_id = traceId();
    const s = await getAdmin();
    const { data: pos } = await s
      .from("positions")
      .select("id,organization_id")
      .eq("id", data.position_id)
      .maybeSingle();
    if (!pos) throw new Error("position_not_found");

    const { data: existing } = await s
      .from("screening_questions")
      .select("id")
      .eq("position_id", data.position_id);
    const existingIds = new Set(((existing ?? []) as AnyRow[]).map((r) => r.id));
    const keepIds = new Set(
      data.questions.map((q) => q.id).filter((v): v is string => Boolean(v)),
    );
    const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      const { error } = await s
        .from("screening_questions")
        .delete()
        .in("id", toDelete);
      if (error) throw new Error(error.message);
    }

    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      const row = {
        position_id: data.position_id,
        question: q.question,
        answer_type: q.answer_type,
        required: q.required,
        dealbreaker: q.dealbreaker,
        scoring_weight: q.scoring_weight,
        display_order: i,
        preferred_answer: (q.preferred_answer ?? null) as never,
        options: (q.options ?? null) as never,
      };
      if (q.id && existingIds.has(q.id)) {
        const { error } = await s
          .from("screening_questions")
          .update(row)
          .eq("id", q.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await s.from("screening_questions").insert(row);
        if (error) throw new Error(error.message);
      }
    }

    await writeAudit({
      actor: context.userId,
      action: "position.screening.save",
      entity_type: "position",
      entity_id: data.position_id,
      organization_id: pos.organization_id,
      after: { count: data.questions.length },
      trace_id,
    });
    return { ok: true as const, trace_id, count: data.questions.length };
  });

export const getPositionActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).optional().default(100),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: rows } = await s
      .from("audit_events")
      .select("id,action,entity_type,entity_id,created_at,actor_user_id,trace_id,before_state,after_state")
      .or(
        `and(entity_type.eq.position,entity_id.eq.${data.id}),and(entity_type.eq.screening_question,entity_id.eq.${data.id})`,
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return (rows ?? []) as AnyRow[];
  });

// ─── Publish Desk — grouped, single source of truth ─────────────────────────
// Publication readiness mirrors DB trigger `tg_candidate_matches_publish_gate`:
//   approved_score_run_id set; run: status=completed, non-empty evidence,
//   final_score <= applied_cap and <= raw_score; identity matches parent match
// Plus admin-facing checks: no critical contradictions, complete Client-safe
// DTO, admin approval, and no fatal processing state.
/**
 * Per-record audit trail for one candidate: every audited change to the match,
 * the underlying application and the candidate profile, newest first. Staff-only.
 */
export const getCandidateAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).optional().default(100),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: match } = await s
      .from("candidate_matches")
      .select("id, application_id, candidate_profile_id")
      .eq("id", data.match_id)
      .maybeSingle();
    const ids = [
      data.match_id,
      (match?.application_id as string | null) ?? null,
      (match?.candidate_profile_id as string | null) ?? null,
    ].filter((v): v is string => Boolean(v));
    const { data: rows } = await s
      .from("audit_events")
      .select(
        "id,action,entity_type,entity_id,created_at,actor_user_id,trace_id,before_state,after_state",
      )
      .in("entity_id", ids)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return (rows ?? []) as AnyRow[];
  });

export const getPublishDeskGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data } = await s
      .from("candidate_matches")
      .select(
        [
          "id,updated_at,admin_status,client_visibility,processing_state,processing_error_code",
          "organization_id,position_id,application_id,candidate_profile_id",
          "current_score_run_id,approved_score_run_id",
          "candidate_profiles(id,full_name,email)",
          "positions(id,title,status,organization_id,approved_at,published_at,payment_status,description,employment_type,work_model,seniority,location,requirements,organizations(id,name))",
          "current_run:score_runs!candidate_matches_current_score_run_id_fkey(id,status,score,confidence,fit_label,contradiction_status,must_have_coverage,position_id,candidate_profile_id,organization_id,application_id)",
          "approved_run:score_runs!candidate_matches_approved_score_run_id_fkey(id,status,score,confidence,fit_label,contradiction_status,must_have_coverage,evidence,raw_score,applied_cap,final_score,position_id,candidate_profile_id,organization_id,application_id)",
        ].join(","),
      )
      .order("updated_at", { ascending: false })
      .limit(500);
    const rows = (data ?? []) as AnyRow[];

    type Group = "needs_review" | "blocked" | "ready" | "published" | "held";
    const buckets: Record<Group, AnyRow[]> = {
      needs_review: [], blocked: [], ready: [], published: [], held: [],
    };
    const FATAL_STATES = new Set(["failed", "provider_blocked", "ocr_required"]);
    const { evaluatePublishGate, PUBLISH_BLOCKER_LABEL } = await import("./publish-gate");

    for (const r of rows) {
      const approved = (r.approved_run ?? null) as AnyRow | null;
      const current = (r.current_run ?? null) as AnyRow | null;
      const pos = (r.positions ?? null) as AnyRow | null;
      const cp = (r.candidate_profiles ?? null) as AnyRow | null;
      const reasons: string[] = [];

      // Role-level blocking reasons (P-032)
      if (pos) {
        const roleBlockers = evaluatePublishGate(pos as any);
        for (const b of roleBlockers) {
          reasons.push(PUBLISH_BLOCKER_LABEL[b]);
        }
      }


      // Fatal processing states
      if (FATAL_STATES.has(r.processing_state)) {
        reasons.push(
          r.processing_state === "ocr_required"
            ? "OCR required on CV — request OCR from the workspace"
            : r.processing_state === "provider_blocked"
            ? "AI provider blocked — resolve in Operations"
            : `Processing failed (${r.processing_error_code ?? "unknown"}) — retry from workspace`,
        );
      }

      // Score presence
      const hasCurrentScore = current?.status === "completed" && current?.score != null;
      const hasApprovedRun = !!approved && approved.status === "completed";
      if (!hasCurrentScore && !hasApprovedRun) reasons.push("Score incomplete — run scoring");

      // Approved-run evidence
      const evidenceArr = Array.isArray(approved?.evidence) ? approved!.evidence : [];
      const evidenceOk = hasApprovedRun && evidenceArr.length > 0;
      if (hasCurrentScore && !approved) reasons.push("Score not approved — review evidence and approve");
      if (hasApprovedRun && !evidenceOk) reasons.push("Approved run has no evidence array");

      // Contradictions
      const contradictionStatus = String(
        approved?.contradiction_status ?? current?.contradiction_status ?? "none",
      );
      const contradictionOk = ["none", "resolved", "cleared"].includes(contradictionStatus);
      if (!contradictionOk) reasons.push(`Contradiction unresolved (${contradictionStatus})`);

      // Client-safe DTO
      const missing: string[] = [];
      if (!cp?.full_name) missing.push("candidate name");
      if (!pos?.title) missing.push("position title");
      if (!pos?.organizations?.name) missing.push("client organization");
      if (missing.length) reasons.push(`Client-safe data incomplete: ${missing.join(", ")}`);

      // Admin approval
      const adminApproved = r.admin_status === "approved";
      if (!adminApproved && r.admin_status !== "on_hold")
        reasons.push(`Admin review ${r.admin_status ?? "pending"}`);

      // Organization / position / identity bindings
      const orgMismatch =
        (pos?.organization_id && pos.organization_id !== r.organization_id) ||
        (approved && approved.organization_id !== r.organization_id);
      if (orgMismatch) reasons.push("Organization binding mismatch");
      const posMismatch = approved && approved.position_id !== r.position_id;
      if (posMismatch) reasons.push("Position binding mismatch");
      const identityMismatch =
        approved &&
        (approved.candidate_profile_id !== r.candidate_profile_id ||
          approved.application_id !== r.application_id);
      if (identityMismatch) reasons.push("Approved run identity mismatch");

      // Position status
      if (!pos?.id) reasons.push("Position missing");
      else if (pos.status === "archived") reasons.push("Position archived");

      // Math invariants (mirror DB gate)
      if (
        approved &&
        (Number(approved.final_score) > Number(approved.applied_cap) ||
          Number(approved.final_score) > Number(approved.raw_score))
      ) {
        reasons.push("Score math invariant broken");
      }

      const canPublish =
        adminApproved &&
        hasApprovedRun &&
        evidenceOk &&
        contradictionOk &&
        !missing.length &&
        !orgMismatch &&
        !posMismatch &&
        !identityMismatch &&
        !FATAL_STATES.has(r.processing_state) &&
        pos?.status !== "archived" &&
        reasons.length === 0;

      const readiness = {
        hasScore: hasCurrentScore || hasApprovedRun,
        evidenceOk,
        contradictionOk,
        clientSafeOk: !missing.length,
        adminApproved,
        orgOk: !orgMismatch && !posMismatch && !identityMismatch,
        canPublish,
        blockedReasons: reasons,
      };
      const enriched: AnyRow = { ...r, _readiness: readiness, score_runs: approved ?? current };

      let group: Group;
      if (r.client_visibility === "visible") group = "published";
      else if (r.admin_status === "on_hold") group = "held";
      else if (canPublish) group = "ready";
      else if (reasons.length > 0) group = "blocked";
      else group = "needs_review";
      buckets[group].push(enriched);
    }

    return buckets;
  });

// ─── Operations: enriched incidents + resolve ────────────────────────────────

export const getOperationsIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: failed } = await s
      .from("processing_jobs")
      .select("id,entity_type,entity_id,job_type,status,attempts,error_code,error_message,trace_id,created_at,started_at,completed_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(200);
    const jobs = (failed ?? []) as AnyRow[];
    const matchIds = Array.from(
      new Set(jobs.filter((j) => j.entity_type === "candidate_match").map((j) => j.entity_id)),
    );
    let matchMap = new Map<string, AnyRow>();
    if (matchIds.length) {
      const { data: matches } = await s
        .from("candidate_matches")
        .select(
          "id,processing_state,candidate_profiles(full_name),positions(title,organizations(name))",
        )
        .in("id", matchIds);
      matchMap = new Map(((matches ?? []) as AnyRow[]).map((m) => [m.id, m]));
    }
    // Active queued/running jobs — to prevent duplicate retries.
    const { data: active } = await s
      .from("processing_jobs")
      .select("entity_id,job_type,status")
      .in("status", ["queued", "running"]);
    const activeKey = new Set(
      ((active ?? []) as AnyRow[]).map((j) => `${j.entity_id}::${j.job_type}`),
    );
    return { jobs, matches: Object.fromEntries(matchMap), active: Array.from(activeKey) };
  });

export const resolveIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ job_id: z.string().uuid(), note: z.string().trim().max(500).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: before } = await s
      .from("processing_jobs")
      .select("id,entity_type,entity_id,status,error_code,error_message")
      .eq("id", data.job_id)
      .maybeSingle();
    if (!before) throw new Error("job_not_found");
    const { error } = await s
      .from("processing_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", data.job_id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actor: context.userId,
      action: "incident.resolve",
      entity_type: before.entity_type,
      entity_id: before.entity_id,
      before,
      after: { status: "cancelled", note: data.note ?? null },
    });
    return { ok: true };
  });
