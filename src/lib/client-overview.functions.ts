// Client overview read (health, queue, milestones, KPIs).
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
  isAwaitingClientDecision,
  type MatchStage,
  type KpiRow,
} from "@/lib/client-kpi.server";
import {
  buildPipelineStatusLine,
  buildPipelineActionLabel,
  type PipelineStatusInput,
} from "@/lib/client-pipeline-language";
import { computeRoleProgress } from "@/lib/client-role-progress";
import { countLanes } from "@/lib/client-pipeline-lane";
import { computeClientRoleStatus } from "@/lib/client-role-status";
import { computeRoleRisk } from "@/lib/client-role-risk";
import { computeHiringHealth } from "@/lib/client-hiring-health";
import { getClientOpenItems, type BlockedRole } from "@/lib/client/open-items.functions";
import { dueLabel as openItemDueLabel } from "@/lib/client/open-items";
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

export const getClientOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    const s = context.supabase as AnyRow;
    // 1. Fetch the unified open items and blocked roles.
    const openItemsResponse = await getClientOpenItems({ data: { orgId: data.orgId } });
    const rows = await loadKpiRows(s, data.orgId);

    const interviewsRes = await s
      .from("interviews")
      .select("id, candidate_match_id, position_id, completed_at, status")
      .eq("organization_id", data.orgId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true })
      .limit(100);
    
    const completedInterviews = (interviewsRes.data as AnyRow[]) ?? [];
    const scoredInterviewIds = new Set<string>();
    if (completedInterviews.length > 0) {
      const { data: cards } = await s
        .from("interview_scorecards")
        .select("interview_id")
        .in("interview_id", completedInterviews.map(i => i.id));
      for (const c of (cards as AnyRow[]) ?? []) {
        scoredInterviewIds.add(c.interview_id as string);
      }
    }

    const { data: positions, error: positionsError } = await context.supabase
      .from("positions")
      .select("id, title, status, updated_at, created_at, organization_id, organizations(name)")

      .eq("organization_id", data.orgId)
      // Active work only: a closed or on-hold role must leave every count and
      // the decision queue in the same refresh.
      .in("status", ["active", "approved"])
      .order("updated_at", { ascending: false });
    const activePositionsList = (positions as AnyRow[]) ?? [];
    const activePositions = activePositionsList.length;
    const kpis = {
      ...computeKpis(rows, activePositions),
      awaiting_decision: openItemsResponse.items.filter(i => i.kind === 'pending_decision').length,
      interviews_to_confirm: openItemsResponse.items.filter(i => i.kind === 'interview').length,
      offers: openItemsResponse.items.filter(i => i.kind === 'offer').length,
      missing_feedback: openItemsResponse.items.filter(i => i.kind === 'missing_feedback').length,
    };


    
    // Summary of blocked roles for the header
    const blocksCount = openItemsResponse.blockedRoles.length;
    const firstBlock = openItemsResponse.blockedRoles[0];
    const blocked_summary = blocksCount > 0 ? {
      count: blocksCount,
      label: `${blocksCount} block${blocksCount === 1 ? '' : 's'} · ${firstBlock.reason} for ${firstBlock.title}`,
      href: firstBlock.href,
    } : null;

    // ── Hiring health line ──────────────────────────────────────────────────
    // One judgement plus three figures. Every input is a recorded date or a
    // stored commitment; nothing is projected. If any input fails to load we
    // return null so the client shows an error state rather than "on track".
    const allPositionIds = activePositionsList.map((p) => p.id as string);
    const { data: healthCommitmentRows, error: healthCommitmentError } = allPositionIds.length
      ? await context.supabase
          .from("position_commitments")
          .select("position_id, first_shortlist_days, baseline_at")
          .eq("organization_id", data.orgId)
          .in("position_id", allPositionIds)
      : { data: [] as AnyRow[], error: null };

    const nowMs = Date.now();
    const deliveredPositionIds = new Set(
      rows.filter((r) => r.delivered_at != null).map((r) => r.position_id),
    );
    const promisedByPosition = new Map<string, number>();
    for (const c of (healthCommitmentRows as AnyRow[]) ?? []) {
      if (!c.baseline_at || c.first_shortlist_days == null) continue;
      promisedByPosition.set(
        c.position_id as string,
        new Date(c.baseline_at as string).getTime() + Number(c.first_shortlist_days) * 86_400_000,
      );
    }
    const rolesWithoutShortlist = allPositionIds.filter((id) => !deliveredPositionIds.has(id));
    const hiring_health =
      positionsError || healthCommitmentError
        ? null
        : computeHiringHealth({
            openRoles: activePositions,
            awaitingDecision: kpis.awaiting_decision,
            rolesWithoutShortlist: rolesWithoutShortlist.length,
            overdueDecisions: rows.filter(
              (r) =>
                r.stage === "delivered" &&
                r.client_decision_due_at != null &&
                new Date(r.client_decision_due_at).getTime() < nowMs,
            ).length,
            behindScheduleRoles: rolesWithoutShortlist.filter((id) => {
              const promised = promisedByPosition.get(id);
              return promised != null && promised < nowMs;
            }).length,
            blocks: blocksCount,
          });

    // "What's new" — matches delivered in the past 7 days.
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const new_this_week = rows.filter(
      (r) =>
        r.delivered_at != null &&
        new Date(r.delivered_at).getTime() >= sevenDaysAgo,
    ).length;


    // ── Detail Accordion ────────────────────────────────────────────────────
    // Internal system instrumentation (System status, agent controls, activity)
    // removed from the client surface to keep it focused on talent operations.



    // "What happens next" — per-position next milestone, only active positions.
    const rowsByPosition = new Map<string, KpiRow[]>();
    for (const r of rows) {
      if (!rowsByPosition.has(r.position_id)) rowsByPosition.set(r.position_id, []);
      rowsByPosition.get(r.position_id)!.push(r);
    }

    // Real stage dates + our own promises — the only inputs to plain-language
    // status and the "at risk" signal. Nothing is inferred or projected.
    const overviewPositionIds = activePositionsList.slice(0, 6).map((p) => p.id as string);
    const overviewStageDates = overviewPositionIds.length
      ? await loadRoleStageDates(context.supabase, data.orgId, overviewPositionIds)
      : new Map();

    const { data: commitmentRows } = overviewPositionIds.length
      ? await context.supabase
          .from("position_commitments")
          .select("position_id, first_shortlist_days, baseline_at")
          .eq("organization_id", data.orgId)
          .in("position_id", overviewPositionIds)
      : { data: [] as AnyRow[] };
    const commitmentByPosition = new Map<string, AnyRow>(
      ((commitmentRows as AnyRow[]) ?? []).map((c) => [c.position_id as string, c]),
    );

    const maxIso = (values: Array<string | null | undefined>) =>
      values
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1) ?? null;
    const minIso = (values: Array<string | null | undefined>) =>
      values.filter((v): v is string => Boolean(v)).sort()[0] ?? null;

    const whats_next = activePositionsList.slice(0, 6).map((p) => {
      const posRows = rowsByPosition.get(p.id) ?? [];
      let next = "Awaiting first candidates";
      if (posRows.some((r) => r.stage === "offer")) next = "Offer response";
      else if (posRows.some((r) => r.interview_active || r.stage === "interview_process"))
        next = "Interview outcome";
      else if (posRows.some((r) => r.stage === "shortlisted")) next = "Interview requests";
      else if (posRows.some((r) => r.stage === "delivered")) next = "Review new candidates";

      const dates = overviewStageDates.get(p.id as string) ?? {
        sourcing: null,
        screening: null,
        shortlist: null,
        offer: null,
      };
      const progress = computeRoleProgress({
        status: p.status as string,
        briefedAt: (p.created_at as string | null) ?? null,
        sourcingStartedAt: dates.sourcing,
        screeningStartedAt: dates.screening,
        shortlistStartedAt: dates.shortlist,
        offerStartedAt: dates.offer,
      });

      const awaiting = posRows.filter(isAwaitingClientDecision);
      const toConfirm = posRows.filter((r) => r.interview_needs_confirmation);
      const commitment = commitmentByPosition.get(p.id as string);
      const promisedShortlistBy =
        commitment?.baseline_at && commitment?.first_shortlist_days != null
          ? new Date(
              new Date(commitment.baseline_at as string).getTime() +
                Number(commitment.first_shortlist_days) * 86_400_000,
            ).toISOString()
          : null;

      const lastMovementAt = maxIso([
        p.updated_at as string | null,
        ...posRows.map((r) => r.stage_entered_at),
        ...posRows.map((r) => r.delivered_at),
        dates.offer,
        dates.shortlist,
        dates.screening,
        dates.sourcing,
      ]);

      const risk = computeRoleRisk({
        status: p.status as string,
        lastMovementAt,
        awaitingDecision: awaiting.length,
        oldestAwaitingDecisionAt: minIso(awaiting.map((r) => r.delivered_at ?? r.stage_entered_at)),
        interviewsToConfirm: toConfirm.length,
        oldestInterviewToConfirmAt: minIso(toConfirm.map((r) => r.interview_requested_at)),

        promisedShortlistBy,
        shortlistDeliveredAt: dates.shortlist,
      });

      return {
        position_id: p.id as string,
        title: p.title as string,
        status: p.status as string,
        next,
        delivered_pending: awaiting.length,
        // Plain-language stage, when it started, and how long it has been there.
        stage_label: progress.currentLabel,
        stage_hint: progress.steps[progress.currentIndex]?.hint ?? "",
        stage_entered_at: progress.currentEnteredAt,
        days_in_stage: progress.daysInCurrentStage,
        stage_caption: progress.caption,
        client_status: computeClientRoleStatus({
          status: p.status as string,
          // Canonical lane counts — identical to the Roles list and role page.
          hires: countLanes(posRows).counts.hired,
          offers: countLanes(posRows).counts.offer,
          interviewing: countLanes(posRows).counts.interview_process,
          shortlisted: countLanes(posRows).counts.shortlisted,
          delivered: awaiting.length,
        }),
        last_movement_at: lastMovementAt,
        promised_shortlist_by: promisedShortlistBy,
        shortlist_delivered_at: dates.shortlist,
        at_risk: risk.atRisk,
        risk_reason: risk.reason,
        risk_cause: risk.cause,
      };
    });

    // ── Decision queue ──────────────────────────────────────────────────────
    // Unified source: the decision queue now reads from the same open items list
    // used by the headers and the "Your open items" strip.
    const queueItems: QueueItem[] = openItemsResponse.items.map((item) => {
      return {
        key: `${item.kind}:${item.id}`,
        kind: item.kind as any,
        concerns: item.label,
        role_title: item.context ?? "Your role",
        position_id: item.href.split('/').pop()?.split('#')[0] || null, // Best effort extraction
        subject_id: item.subject_id,
        due_at: item.due_at,
        overdue: item.overdue,
        due_label: openItemDueLabel(item, nowMs),
        waiting_since: item.waiting_since ?? null,
        action: item.kind === "info_request" ? "Answer" : 
                item.kind === "pending_decision" ? "Review candidate" :
                item.kind === "missing_feedback" ? "Give feedback" :
                item.kind === "offer" ? "View offer" : "View",
        to: item.href,
      };
    });

    const queueGroups = buildQueue(queueItems);
    const decision_queue = [...queueGroups.overdue, ...queueGroups.upcoming];
    const decision_queue_meta = {
      checked: openItemsResponse.items.length,
      overdue: queueGroups.overdue.length,
      next_expected_at:
        Array.from(promisedByPosition.values())
          .filter((ms) => ms > nowMs)
          .sort((a, b) => a - b)
          .map((ms) => new Date(ms).toISOString())[0] ?? null,
    };
    const completedList = completedInterviews.filter((iv) => {
      const happened = (iv.completed_at as string | null) ?? (iv.scheduled_at as string | null) ?? null;
      if (!happened) return false;
      return new Date(happened).getTime() < nowMs;
    });

    // ── What happens next ───────────────────────────────────────────────────
    // One milestone per active role, so "when do I see candidates?" is answered
    // on screen instead of by email. Dates come only from stored commitments
    // and recorded due dates; roles whose commitment failed to load are marked
    // so the client sees an error row rather than a silently missing role.
    const feedbackDueByPosition = new Map<string, string>();
    for (const iv of completedList) {
      if (scoredInterviewIds.has(iv.id as string)) continue;
      const pid = iv.position_id as string | null;
      const completedAt = iv.completed_at as string | null;
      if (!pid || !completedAt) continue;
      const due = new Date(new Date(completedAt).getTime() + 2 * 86_400_000).toISOString();
      const existing = feedbackDueByPosition.get(pid);
      if (!existing || due < existing) feedbackDueByPosition.set(pid, due);
    }
    const offerDueByPosition = new Map<string, string>();
    for (const r of rows) {
      if (r.stage !== "offer" || !r.client_decision_due_at) continue;
      const existing = offerDueByPosition.get(r.position_id);
      if (!existing || r.client_decision_due_at < existing) {
        offerDueByPosition.set(r.position_id, r.client_decision_due_at);
      }
    }

    const next_milestones = activePositionsList.map((p) => {
      const pid = p.id as string;
      const posRows = rowsByPosition.get(pid) ?? [];
      // A commitment read failure must not read as "no date committed".
      if (healthCommitmentError) {
        return {
          position_id: pid,
          title: p.title as string,
          error: true as const,
        };
      }
      const promised = promisedByPosition.get(pid);
      return {
        ...computeNextMilestone({
          position_id: pid,
          title: p.title as string,
          awaiting_review: posRows.filter(isAwaitingClientDecision).length,
          has_offer: posRows.some((r) => r.stage === "offer"),
          has_interview: posRows.some((r) => r.interview_active || r.stage === "interview_process"),
          promised_shortlist_by: promised != null ? new Date(promised).toISOString() : null,
          shortlist_delivered_at:
            posRows
              .map((r) => r.delivered_at)
              .filter((v): v is string => Boolean(v))
              .sort()[0] ?? null,
          feedback_due_at: feedbackDueByPosition.get(pid) ?? null,
          offer_response_due_at: offerDueByPosition.get(pid) ?? null,
        }),
        error: false as const,
      };
    });
    const next_milestones_failed = Boolean(positionsError);

    // Latest delivered candidates (top 4 — kept concise).
    const { data: latestMatches } = await context.supabase
      .from("candidate_matches")
      .select(
        `id, stage, delivered_at, position_id, candidate_profile_id,
         candidate_profiles(id, full_name, headline, location, availability, years_experience, summary),
         positions(id, title),
         score_runs:approved_score_run_id (score, fit_label, explanation, result, requirement_coverage, evidence, completed_at, engine_version, input_hash)`,
      )
      .eq("organization_id", data.orgId)
      .eq("client_visibility", "visible")
      .order("delivered_at", { ascending: false })
      .limit(4);
    const latest_candidates = (
      await hydrateClientCandidateProfiles(latestMatches as AnyRow[])
    ).map(toClientCandidateDTO);

    // Recent messages (last 3). Attributed to the real sender: labelling a
    // client's own message "TaaSFlow" made the panel read as if we wrote it.
    const { data: recentMessages } = await context.supabase
      .from("messages")
      .select("id, body, created_at, sender_user_id, thread_id")
      .eq("thread_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(3);
    const recentMessageRows = (recentMessages as AnyRow[]) ?? [];
    const recent_messages = [];
    if (recentMessageRows.length > 0) {
      const senderIds = [
        ...new Set(
          recentMessageRows
            .map((m) => (m.sender_user_id as string | null) ?? null)
            .filter((v): v is string => !!v),
        ),
      ];
      const senderMeta = new Map<string, { name: string; isStaff: boolean }>();
      if (senderIds.length > 0) {
        const { supabaseAdmin: nameDb } = await import("@/integrations/supabase/client.server");
        const [{ data: senderProfiles }, { data: memberships }] = await Promise.all([
          (nameDb as AnyRow)
            .from("profiles")
            .select("auth_user_id, full_name, email")
            .in("auth_user_id", senderIds),
          (nameDb as AnyRow)
            .from("memberships")
            .select("user_id, role")
            .in("user_id", senderIds)
            .eq("status", "active"),
        ]);
        
        const { resolveStaffPersona } = await import("./staff-persona.server");
        const staffRoles = new Set(["platform_admin", "operations"]);

        for (const p of (senderProfiles as AnyRow[] | undefined) ?? []) {
          const id = p.auth_user_id as string;
          const m = (memberships as AnyRow[] | undefined)?.find(mem => mem.user_id === id);
          const isStaff = m ? staffRoles.has(m.role) : false;
          const persona = resolveStaffPersona({
            name: p.full_name as string | null,
            email: p.email as string | null,
            isStaff,
            maskStatus: true, // Overview card doesn't need (Staff) suffix.
          });
          senderMeta.set(id, { name: persona.name, isStaff: persona.isStaff });
        }
      }

      for (const m of recentMessageRows) {
        const sid = (m.sender_user_id as string | null) ?? null;
        const meta = sid ? senderMeta.get(sid) : null;
        recent_messages.push({
          ...m,
          sender_name: !sid
            ? "TaaSFlow team"
            : sid === context.userId
              ? "You"
              : (meta?.name ?? "Teammate"),
          mine: sid === context.userId,
        });
      }
    }


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
    // audit_events is staff-only under RLS; read the whitelisted client-facing
    // actions with the admin client, still scoped to this organization.
    const { supabaseAdmin: auditDb } = await import("@/integrations/supabase/client.server");
    const { data: events } = await (auditDb as AnyRow)
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
      hiring_health,
      org: {
        id: data.orgId,
        name: activePositionsList[0]?.organizations?.name ?? "Your workspace",
      },


      active_positions: activePositions,
      blocked_summary,
      new_this_week,
      whats_next,
      decision_queue,
      decision_queue_meta,
      next_milestones,
      next_milestones_failed,
      latest_candidates,
      recent_messages,
      recent_activity: (events as AnyRow[]) ?? [],
      last_updated,
    };

  });
