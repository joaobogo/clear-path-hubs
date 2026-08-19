// Position list, detail and blueprint confirmation.
// Thin server-function wrapper: helpers live in client-shared.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { briefField } from "@/lib/position-info-requests";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CLIENT_PERMISSIONS, type ClientPermission } from "@/lib/authz";
import { computeRoleLaunchState } from "@/lib/role-launch.server";
import { DECLINE_REASONS } from "@/lib/client-decision-reasons";
import {
  DEAL_BREAKER_REASON_CODES,
  normalizeDealBreakers,
} from "@/lib/client-deal-breakers";

import {
  CLIENT_CANDIDATE_SELECT,

  loadKpiRows,
  loadRoleStageDates,
  computeKpis,
  loadClientEvidenceItems,
  toClientCandidateDTO,
  TOP_FIT_LABELS,
  type MatchStage,
  type KpiRow,
} from "@/lib/client-kpi.server";
import {
  buildPipelineStatusLine,
  buildPipelineActionLabel,
  buildPipelineActionTarget,
  type PipelineStatusInput,
} from "@/lib/client-pipeline-language";
import { computeRoleProgress } from "@/lib/client-role-progress";
import { countLanes } from "@/lib/client-pipeline-lane";
import { computeClientRoleStatus } from "@/lib/client-role-status";
import { statusesForRoleTab } from "@/lib/client-role-status-tabs";
import { computeRoleRisk } from "@/lib/client-role-risk";
import { computeHiringHealth } from "@/lib/client-hiring-health";
import { buildQueue, type QueueItem } from "@/lib/client-decision-queue";
import { buildOfferRow } from "@/lib/client-offer-holder";
import { computeNextMilestone } from "@/lib/client-next-milestone";
import { buildRoleTimeline } from "@/lib/client-role-timeline";
import { assertWorkspaceAccess, readWorkspaceAccess } from "@/lib/authz/workspace-access";
import { hydrateClientCandidateProfiles } from "@/lib/client-candidate-hydrate.server";
import {
  advanceGateError,
  stageNeedsAgreedBrief,
  evaluateAdvanceGate,
} from "@/lib/client/advance-gate";
import { assessFreshness, type Freshness } from "@/lib/scoring/score-freshness";
import { buildRequirementRows } from "@/lib/client-fit-presentation";
import { buildRoleStory, type StoryCandidate } from "@/lib/client/role-story";

import {
  type AnyRow,
  type ClientRole,
  type CandidateFilter,
  type ClientActionKey,
  traceId,
  resolveContext,
  HEX_COLOR,
  brandingSchema,
  pipelineLanguageInput,
  nextMilestoneFor,
  STAGE_GRAPH,
  assertNotSupportViewReadOnly,
  assertEditor,
  loadMatch,
  writeAudit,
  UNDO_WINDOW_MS,
  ACTION_TO_STAGE,
  CLIENT_ACTION_KEYS,
  REASON_REQUIRED,
  CLIENT_DECLINE_CODES,
  assertOrgAdmin,
  clientMemberRoleZ,
  notifPrefsShape,
  companyProfileZ,
  notifPrefsZ,
  timezoneZ,
  confirmBlueprintSchema,
} from "@/lib/client-shared.server";

export const getClientPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; status?: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        // Tab key, not a raw DB status: expanded below so intermediate
        // statuses (submitted, under_review, needs_clarification, approved)
        // can never fall outside every tab.
        status: z.enum(["active", "draft", "paused", "closed"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    // "Archived" keeps closed roles readable: filled, closed and archived.
    const ALL_STATUSES = [
      "draft",
      "submitted",
      "under_review",
      "needs_clarification",
      "approved",
      "active",
      "paused",
      "filled",
      "closed",
      "archived",
    ];
    const statusFilter: string[] = data.status
      ? statusesForRoleTab(data.status)
      : ALL_STATUSES;
    const { data: positions, error } = await context.supabase
      .from("positions")
      .select(
        "id, title, status, location, work_model, employment_type, seniority, updated_at, created_at, published_at, approved_at",
      )
      .eq("organization_id", data.orgId)
      .eq("is_test_record", false)
      .in("status", statusFilter as never)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = await loadKpiRows(context.supabase, data.orgId);
    const stageDates = await loadRoleStageDates(
      context.supabase,
      data.orgId,
      (positions as AnyRow[]).map((p) => p.id as string),
    );
    const byPosition = new Map<string, KpiRow[]>();
    for (const r of rows) {
      if (!byPosition.has(r.position_id)) byPosition.set(r.position_id, []);
      byPosition.get(r.position_id)!.push(r);
    }
    return (positions as AnyRow[]).map((p) => {
      const posRows = byPosition.get(p.id) ?? [];
      const kpi = computeKpis(posRows, 0);
      const language = pipelineLanguageInput(posRows, p.status);
      return {
        ...p,

        kpis: kpi,
        // Single shared mapping — the same role never shows two statuses.
        client_status: computeClientRoleStatus({
          status: String(p.status),
          hires: kpi.hires,
          offers: kpi.offers,
          interviewing: kpi.interviewing,
          shortlisted: kpi.shortlisted,
          delivered: kpi.awaiting_decision,
        }),
        pipeline_line: buildPipelineStatusLine(language),
        progress: computeRoleProgress({
          status: String(p.status),
          briefedAt: (p.approved_at as string | null) ?? (p.created_at as string | null),
          sourcingStartedAt: stageDates.get(p.id)?.sourcing ?? (p.published_at as string | null),
          screeningStartedAt: stageDates.get(p.id)?.screening ?? null,
          shortlistStartedAt: stageDates.get(p.id)?.shortlist ?? null,
          offerStartedAt: stageDates.get(p.id)?.offer ?? null,
        }),
        next_milestone: nextMilestoneFor(posRows, p.status),
        action_required: buildPipelineActionLabel(language),
        // Deep-link for "Review →": exact ids, same precedence as the label.
        action_target: buildPipelineActionTarget({
          ...language,
          positionId: String(p.id),
          interviewToConfirmId:
            posRows.find((r) => r.interview_needs_confirmation && r.interview_id)
              ?.interview_id ?? null,
        }),
      };
    });
  });

export const getClientPositionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId: string }) =>
    z.object({ orgId: z.string().uuid(), positionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    const { data: position, error } = await context.supabase
      .from("positions")
      .select(
        `id, title, status, visibility, location, work_model, employment_type, seniority, department,
         description, requirements, preferred_requirements, dealbreakers, openings,
         compensation, work_authorization, intake_context, evaluation_weights,
         blueprint, blueprint_status, blueprint_generated_at, blueprint_confirmed_at,
         jd_file_name, jd_source, company_research,
         published_at, approved_at, submitted_at, closed_at, created_at, updated_at`,
      )

      .eq("organization_id", data.orgId)
      .eq("id", data.positionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!position) return null;

    // Client-visible candidates only. Wrong-tenant / unpublished filtered at source.
    const { data: rawMatches } = await context.supabase
      .from("candidate_matches")
      .select(
        `id, stage, admin_status, delivered_at, approved_score_run_id, candidate_profile_id,
         candidate_profiles(id, full_name, headline, location),
         score_runs:approved_score_run_id (score, fit_label, fit_band, explanation, requirement_coverage)`,
      )
      .eq("organization_id", data.orgId)
      .eq("position_id", data.positionId)
      .eq("client_visibility", "visible")
      .order("delivered_at", { ascending: false });
    const matches = await hydrateClientCandidateProfiles(rawMatches as AnyRow[]);

    // Recent activity — sanitized safe audit trail for this position.
    // Filter out internal admin_note / scoring_weight / score_run.* actions.
    // audit_events is staff-only under RLS, so read it with the admin client
    // after the workspace check above and keep the org/position/action filters.
    const { supabaseAdmin: auditDb } = await import("@/integrations/supabase/client.server");
    const { data: rawActivity } = await (auditDb as AnyRow)
      .from("audit_events")
      .select("id, action, created_at, actor_user_id")
      .eq("organization_id", data.orgId)
      .eq("entity_id", data.positionId)
      .order("created_at", { ascending: false })
      .limit(20);
    const { CLIENT_SAFE_ROLE_ACTIONS } = await import("@/lib/client/role-audit-humanizer");
    const activity = ((rawActivity as AnyRow[]) ?? [])
      .filter((a) => CLIENT_SAFE_ROLE_ACTIONS.includes(String(a.action ?? "")))
      .slice(0, 10);

    // Pipeline counts — the canonical KPI rows for THIS role, run through the
    // one lane derivation. The role page used to count raw stages on its own
    // query, which is how it could say "0 hired" beside "1 hire confirmed".
    const roleKpiRows = (await loadKpiRows(context.supabase, data.orgId)).filter(
      (r) => r.position_id === data.positionId,
    );
    const roleKpis = computeKpis(roleKpiRows, 0);
    const laneCounts = countLanes(roleKpiRows).counts;
    const stageCounts: Record<string, number> = {
      delivered: laneCounts.delivered,
      shortlisted: laneCounts.shortlisted,
      interview_process: laneCounts.interview_process,
      offer: laneCounts.offer,
      hired: laneCounts.hired,
      not_moving_forward: laneCounts.not_moving_forward,
    };
    const openings = Math.max(1, Number(position.openings ?? 1));
    const hires = stageCounts.hired ?? 0;
    const remaining = Math.max(0, openings - hires);


    // Interview state for the plain-language status line.
    const matchIdList = ((matches as AnyRow[]) ?? []).map((m) => m.id as string);
    let interviewsToConfirm = 0;
    let interviewsScheduled = 0;
    let nextInterviewAt: string | null = null;
    if (matchIdList.length > 0) {
      const { data: ivs } = await context.supabase
        .from("interviews")
        .select("candidate_match_id, status, scheduled_at")
        .in("candidate_match_id", matchIdList)
        .in("status", ["requested", "scheduling", "scheduled"]);
      const confirmSet = new Set<string>();
      const scheduledSet = new Set<string>();
      for (const iv of (ivs as AnyRow[]) ?? []) {
        if (iv.status === "scheduled") {
          scheduledSet.add(iv.candidate_match_id);
          const at = iv.scheduled_at as string | null;
          if (at && (!nextInterviewAt || at < nextInterviewAt)) nextInterviewAt = at;
        } else {
          confirmSet.add(iv.candidate_match_id);
        }
      }
      interviewsToConfirm = confirmSet.size;
      interviewsScheduled = scheduledSet.size;
    }
    // Same vocabulary mapper the Roles list and Overview use, fed the same
    // canonical rows — one sentence, one set of numbers.
    const pipelineLine = buildPipelineStatusLine(
      pipelineLanguageInput(roleKpiRows, String(position.status)),
    );

    const positionStageDates = (
      await loadRoleStageDates(context.supabase, data.orgId, [data.positionId])
    ).get(data.positionId);

    // Role launch state — timeline + channels, derived from real records only.
    const { data: campaigns } = await context.supabase
      .from("outreach_campaigns")
      .select("id, name, channel, status, started_at, ended_at, created_at")
      .eq("organization_id", data.orgId)
      .eq("position_id", data.positionId)
      .order("created_at", { ascending: true });

    const { count: applicationCount } = await context.supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("position_id", data.positionId);

    const deliveredAt =
      ((matches as AnyRow[]) ?? [])
        .map((m) => m.delivered_at as string | null)
        .filter((v): v is string => Boolean(v))
        .sort()[0] ?? null;

    // Verified outreach activity for this role (RLS-scoped to the org).
    const campaignIds = ((campaigns as AnyRow[]) ?? []).map((c) => c.id as string);
    let touches: AnyRow[] = [];
    if (campaignIds.length > 0) {
      const { data: touchRows } = await context.supabase
        .from("outreach_touches")
        .select(
          "id, candidate_profile_id, sent_at, delivered_at, replied_at, engagement_state, is_test_record, created_at",
        )
        .eq("organization_id", data.orgId)
        .in("campaign_id", campaignIds);
      touches = (touchRows as AnyRow[]) ?? [];
    }

    // Source attribution — real application rows only.
    const { data: appSources } = await context.supabase
      .from("applications")
      .select("source_kind")
      .eq("position_id", data.positionId);
    const attributionMap = new Map<string, number>();
    for (const a of (appSources as AnyRow[]) ?? []) {
      const src = String(a.source_kind ?? "").trim();
      if (!src) continue;
      attributionMap.set(src, (attributionMap.get(src) ?? 0) + 1);
    }
    const attribution = [...attributionMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    // Dated timeline — real stored timestamps only, no inference from siblings.
    const minOf = (values: (string | null | undefined)[]) =>
      values.filter((v): v is string => Boolean(v)).sort()[0] ?? null;

    const [historyRes, timelineInterviewsRes] = await Promise.all([
      context.supabase
        .from("candidate_stage_history")
        .select("to_stage, created_at")
        .eq("organization_id", data.orgId)
        .eq("position_id", data.positionId)
        .in("to_stage", ["shortlisted", "offer", "hired"]),
      matchIdList.length > 0
        ? context.supabase
            .from("interviews")
            .select("scheduled_at, completed_at")
            .in("candidate_match_id", matchIdList)
        : Promise.resolve({ data: [] as AnyRow[] }),
    ]);
    const historyRows = ((historyRes as AnyRow).data as AnyRow[]) ?? [];
    const stageFirst = (stage: string) =>
      minOf(historyRows.filter((h) => h.to_stage === stage).map((h) => h.created_at as string));
    const firstInterviewAt = minOf(
      (((timelineInterviewsRes as AnyRow).data as AnyRow[]) ?? []).flatMap((iv) => [
        iv.completed_at as string | null,
        iv.scheduled_at as string | null,
      ]),
    );
    const timeline = buildRoleTimeline({
      briefConfirmedAt:
        (position.blueprint_confirmed_at as string | null) ??
        (position.approved_at as string | null),
      sourcingStartedAt:
        ((campaigns as AnyRow[]) ?? [])
          .filter((c) => !c.is_test_record)
          .map((c) => c.started_at as string | null)
          .filter((v): v is string => Boolean(v))
          .sort()[0] ?? (position.published_at as string | null),
      firstShortlistAt: minOf([stageFirst("shortlisted"), deliveredAt]),
      firstInterviewAt,
      offerAt: stageFirst("offer"),
      hiredAt: stageFirst("hired"),
    });

    const launch = computeRoleLaunchState({
      position,
      campaigns: ((campaigns as AnyRow[]) ?? []).filter((c) => !c.is_test_record),
      matchCount: ((matches as AnyRow[]) ?? []).length,
      deliveredAt,
      applicationCount: applicationCount ?? 0,
      touches,
      attribution,
    });

    // Expected first shortlist — only when a commitment baseline exists.
    const { data: commitment } = await context.supabase
      .from("position_commitments")
      .select(
        "position_id, baseline_at, first_shortlist_days, shortlist_size, interview_slots_hours",
      )
      .eq("position_id", data.positionId)
      .maybeSingle();

    // Named recruiter for the delivery commitment block. Staff profiles are not
    // client-readable under RLS, so read just the name with elevated access.
    let commitmentContactName: string | null = null;
    const ownerUserId = (position as AnyRow).owner_user_id as string | null | undefined;
    if (ownerUserId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: owner } = await (supabaseAdmin as AnyRow)
        .from("profiles")
        .select("full_name")
        .eq("auth_user_id", ownerUserId)
        .maybeSingle();
      commitmentContactName = (owner?.full_name as string | null) ?? null;
    }
    const firstShortlistExpectedAt = (() => {
      const c = commitment as AnyRow | null;
      if (!c?.baseline_at || c.first_shortlist_days == null) return null;
      const base = Date.parse(String(c.baseline_at));
      if (Number.isNaN(base)) return null;
      return new Date(base + Number(c.first_shortlist_days) * 86_400_000).toISOString();
    })();

    // ── The role story ──────────────────────────────────────────────────────
    // Requirement coverage across the shortlist, the fit spread of everyone
    // delivered, and the next milestone. Each figure is derived from the same
    // requirement rows the candidate cards use, so a client can click from a
    // segment straight to the quote behind it.
    const storyEvidence = await loadClientEvidenceItems(context.supabase, matchIdList).catch(
      () => new Map<string, AnyRow[]>(),
    );
    const storyCandidates: StoryCandidate[] = ((matches as AnyRow[]) ?? []).map((m) => {
      const run = (m.score_runs ?? null) as AnyRow;
      return {
        match_id: String(m.id),
        name: (m.candidate_profiles?.full_name as string | null) ?? null,
        stage: String(m.stage),
        score: run?.score == null ? null : Number(run.score),
        requirement_rows: buildRequirementRows(
          {
            requirements: position.requirements,
            preferred_requirements: position.preferred_requirements,
          },
          run?.requirement_coverage ?? null,
          (storyEvidence.get(String(m.id)) as AnyRow[] | undefined) ?? null,
        ),
      };
    });
    const story = buildRoleStory({
      status: String(position.status),
      candidates: storyCandidates,
      nextInterviewAt,
      firstShortlistExpectedAt,
      openings,
      hires,
    });

    // ── Companion payloads, one round trip ──────────────────────────────────
    // Lifecycle, handoff, closure, recap and open information requests all read
    // from this same role. Fetching them here means the detail page renders one
    // coherent loading state instead of six staggered ones. Each is optional:
    // a failure degrades that section to null rather than failing the page.
    const [lifecycleRes, handoffRes, closureRes, infoRes] = await Promise.all([
      import("@/lib/role-lifecycle/role-lifecycle.server")
        .then((m) => m.loadRoleLifecycle(context.supabase, data))
        .catch(() => null),
      import("@/lib/hire-handoff.server")
        .then((m) => m.loadPositionHandoff(context.supabase, data))
        .catch(() => null),
      import("@/lib/role-closure.server")
        .then((m) => m.loadRoleClosure(context.supabase, data))
        .catch(() => null),
      import("@/lib/position-info-requests.server")
        .then((m) =>
          m.loadInfoRequests(context.supabase, {
            orgId: data.orgId,
            positionId: data.positionId,
          }),
        )
        .catch(() => ({ requests: [] })),
    ]);
    // The recap only exists for a closed (not paused) role, so it depends on
    // the closure record and cannot be fanned out with the rest.
    const recapRes =
      closureRes && !closureRes.paused
        ? await import("@/lib/role-recap.server")
            .then((m) => m.loadRoleRecap(context.supabase, data))
            .catch(() => null)
        : null;

    return {
      lifecycle: lifecycleRes,
      handoff: handoffRes,
      closure: closureRes,
      recap: recapRes,
      info_requests: infoRes.requests,
      position,
      matches: (matches as AnyRow[]) ?? [],
      activity,
      launch,
      timeline,
      first_shortlist_expected_at: firstShortlistExpectedAt,
      story,
      commitment: (commitment as AnyRow | null)
        ? {
            position_id: String((commitment as AnyRow)['position_id']),
            first_shortlist_days: Number((commitment as AnyRow)['first_shortlist_days']),
            shortlist_size: Number((commitment as AnyRow)['shortlist_size']),
            interview_slots_hours: Number((commitment as AnyRow)['interview_slots_hours']),
            baseline_at: String((commitment as AnyRow)['baseline_at']),
          }
        : null,
      commitment_contact_name: commitmentContactName,
      kpis: roleKpis,
      summary: {
        openings,
        hires,
        remaining,
        delivered: stageCounts.delivered,
        shortlisted: stageCounts.shortlisted,
        interviewing: stageCounts.interview_process,
        offers: stageCounts.offer,
        not_moving_forward: stageCounts.not_moving_forward,
        pipeline_line: pipelineLine,
        client_status: computeClientRoleStatus({
          status: String(position.status),
          hires: stageCounts.hired,
          offers: stageCounts.offer,
          interviewing: stageCounts.interview_process,
          shortlisted: stageCounts.shortlisted,
          delivered: stageCounts.delivered,
        }),
      },
      progress: computeRoleProgress({
        status: String(position.status),
        briefedAt:
          (position.approved_at as string | null) ?? (position.created_at as string | null),
        sourcingStartedAt: positionStageDates?.sourcing ?? (position.published_at as string | null),
        screeningStartedAt: positionStageDates?.screening ?? null,
        shortlistStartedAt: positionStageDates?.shortlist ?? null,
        offerStartedAt: positionStageDates?.offer ?? null,
      }),
    };
  });

/**
 * The client signs off on the AI-generated blueprint. This never changes the
 * generated content — it only records that a human reviewed it, which the
 * admin review centre and the delivery gate both read.
 */
export const confirmRoleBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof confirmBlueprintSchema>) =>
    confirmBlueprintSchema.parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId, data.orgId);
    const trace_id = crypto.randomUUID();
    const { data: before } = await context.supabase
      .from("positions")
      .select("id, blueprint_status, blueprint_confirmed_at")
      .eq("organization_id", data.orgId)
      .eq("id", data.positionId)
      .maybeSingle();
    if (!before) throw new Error("Position not found");

    const { data: after, error } = await context.supabase
      .from("positions")
      .update({ blueprint_confirmed_at: new Date().toISOString() })
      .eq("organization_id", data.orgId)
      .eq("id", data.positionId)
      .select("id, blueprint_confirmed_at")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.position.blueprint.confirm",
      entity_type: "positions",
      entity_id: data.positionId,
      organization_id: data.orgId,
      before,
      after,
      trace_id,
    });
    return { ok: true as const, confirmed_at: (after as AnyRow)?.blueprint_confirmed_at as string };
  });

/**
 * In-app role creation for a signed-in workspace. The public intake wizard is
 * for visitors who have no account yet; a client admin who already has a
 * workspace gets a draft in THIS organization and goes straight to the edit
 * wizard. Draft state therefore lives on the position row, scoped by
 * organization — it can never be read by another user or workspace.
 */
export const createWorkspacePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; title: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        title: z.string().trim().min(2, "Give the role a title").max(200),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertEditor(context.supabase, context.userId, data.orgId);
    const trace_id = crypto.randomUUID();
    const { data: created, error } = await context.supabase
      .from("positions")
      .insert({
        organization_id: data.orgId,
        title: data.title,
        status: "draft",
        visibility: "private",
        created_by: context.userId,
      } as never)
      .select("id, title, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Could not create the role");
    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.position.create",
      entity_type: "positions",
      entity_id: (created as AnyRow).id as string,
      organization_id: data.orgId,
      after: created,
      trace_id,
    });
    return { ok: true as const, id: (created as AnyRow).id as string, trace_id };
  });
