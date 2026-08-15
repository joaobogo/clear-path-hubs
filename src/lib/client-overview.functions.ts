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
    const rows = await loadKpiRows(context.supabase, data.orgId);

    const { data: positions, error: positionsError } = await context.supabase
      .from("positions")
      .select("id, title, status, updated_at, created_at")
      .eq("organization_id", data.orgId)
      // Active work only: a closed or on-hold role must leave every count and
      // the decision queue in the same refresh.
      .in("status", ["active", "approved"])
      .order("updated_at", { ascending: false });
    const activePositionsList = (positions as AnyRow[]) ?? [];
    const activePositions = activePositionsList.length;
    const kpis = computeKpis(rows, activePositions);

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
          });

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
      if (isAwaitingClientDecision(r)) {
        positionCounts.set(r.position_id, (positionCounts.get(r.position_id) ?? 0) + 1);
      }
    }
    const action_required: Array<{ type: string; label: string; href: string; count?: number }> =
      [];
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
      else if (posRows.some((r) => r.stage === "shortlisted")) next = "Send interview requests";
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
        oldestInterviewToConfirmAt: minIso(
          toConfirm.map((r) => r.interview_requested_at ?? r.stage_entered_at),
        ),
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
    // The only work list on the client's first screen. Four real sources:
    // candidates delivered and awaiting review, interview feedback still
    // outstanding, offers awaiting a response, and information requests from
    // the recruiting team. Each item carries the role, what it concerns, its
    // recorded due date and when the wait started; ordering, deduping and
    // overdue grouping happen in the pure module.
    // Awaiting a decision means the same thing here as it does in the health
    // strip: delivered to this workspace and no decision recorded yet. Anything
    // else would let two panels contradict each other on the same screen.
    const queueRows = rows.filter(
      (r) =>
        r.stage === "delivered" ||
        r.interview_needs_confirmation ||
        r.stage === "offer" ||
        isAwaitingClientDecision(r),
    );
    const queueNames = new Map<string, string>();
    if (queueRows.length > 0) {
      const { data: queueMatches } = await context.supabase
        .from("candidate_matches")
        .select("id, candidate_profile_id, candidate_profiles(full_name)")
        .in(
          "id",
          queueRows.map((r) => r.id),
        );
      for (const m of await hydrateClientCandidateProfiles(queueMatches as AnyRow[])) {
        queueNames.set(m.id as string, (m.candidate_profiles?.full_name as string) || "Candidate");
      }
    }
    const titleByPosition = new Map<string, string>(
      activePositionsList.map((p) => [p.id as string, p.title as string]),
    );

    // Offers carry their own agreed response date. When one exists and it has
    // passed, the queue item reads as overdue against that date — the holder is
    // derived from recorded events, never from a manual field.
    const offerByMatch = new Map<string, { due: string | null; holder: string; open: boolean }>();
    const offerMatchIds = queueRows.filter((r) => r.stage === "offer").map((r) => r.id);
    if (offerMatchIds.length > 0) {
      const { data: offerRows } = await context.supabase
        .from("hire_records")
        .select(
          "candidate_match_id, status, drafted_at, sent_at, negotiating_at, accepted_at, declined_at, hired_at, closed_at, last_nudged_at, start_date, expected_response_date",
        )
        .eq("organization_id", data.orgId)
        .in("candidate_match_id", offerMatchIds);
      for (const o of (offerRows as AnyRow[]) ?? []) {
        const built = buildOfferRow(o as never);
        offerByMatch.set(o.candidate_match_id as string, {
          due: (o.expected_response_date as string | null) ?? null,
          holder: built.holder_label,
          open: built.open,
        });
      }
    }

    const queueItems: QueueItem[] = queueRows.map((r) => {
      const concerns = queueNames.get(r.id) ?? "Candidate";
      const role_title = titleByPosition.get(r.position_id) ?? "Your role";
      const base = {
        concerns,
        role_title,
        position_id: r.position_id,
        subject_id: r.id,
      };
      if (r.interview_needs_confirmation) {
        return {
          ...base,
          key: `interview:${r.id}`,
          kind: "interview" as const,
          due_at: r.next_interview_at ?? null,
          waiting_since: r.interview_requested_at ?? r.stage_entered_at,
          action: "Confirm a time",
          to: "/client/interviews",
        };
      }
      if (r.stage === "offer") {
        const offer = offerByMatch.get(r.id);
        return {
          ...base,
          key: `offer:${r.id}`,
          kind: "offer" as const,
          due_at: offer?.due ?? r.client_decision_due_at ?? null,
          waiting_since: r.stage_entered_at,
          action: offer ? `Follow up — waiting on ${offer.holder}` : "Follow up",
          to: "/client/offers",
        };
      }
      return {
        ...base,
        key: `decision:${r.id}`,
        kind: "decision" as const,
        due_at: r.client_decision_due_at ?? null,
        waiting_since: r.delivered_at ?? r.stage_entered_at,
        action: "Review candidate",
        to: `/client/candidates/${r.id}`,
      };
    });

    // Interview feedback outstanding: the interview happened, no feedback yet.
    // The prompt appears the day after the interview — a date derived from the
    // recorded completion or the scheduled time, never an email nag.
    const nowIsoFeedback = new Date().toISOString();
    const { data: completedInterviews } = await context.supabase
      .from("interviews")
      .select("id, candidate_match_id, position_id, completed_at, scheduled_at, status")
      .eq("organization_id", data.orgId)
      .in("status", ["scheduled", "completed"])
      .order("scheduled_at", { ascending: true })
      .limit(100);
    const completedList = ((completedInterviews as AnyRow[]) ?? []).filter((iv) => {
      const happened =
        (iv.completed_at as string | null) ?? (iv.scheduled_at as string | null) ?? null;
      return !!happened && happened < nowIsoFeedback;
    });
    const scoredInterviewIds = new Set<string>();
    if (completedList.length > 0) {
      const { data: cards } = await context.supabase
        .from("interview_scorecards")
        .select("interview_id")
        .in(
          "interview_id",
          completedList.map((i) => i.id as string),
        );
      for (const c of (cards as AnyRow[]) ?? []) {
        scoredInterviewIds.add(c.interview_id as string);
      }
    }
    // A feedback item names the person it concerns. Their match is often no
    // longer in the decision queue (they are past delivery), so resolve those
    // names explicitly rather than falling back to "Candidate".
    const feedbackMatchIds = completedList
      .filter((iv) => !scoredInterviewIds.has(iv.id as string))
      .map((iv) => iv.candidate_match_id as string | null)
      .filter((id): id is string => !!id && !queueNames.has(id));
    if (feedbackMatchIds.length > 0) {
      const { data: fbMatches } = await context.supabase
        .from("candidate_matches")
        .select("id, candidate_profile_id, candidate_profiles(full_name)")
        .in("id", Array.from(new Set(feedbackMatchIds)));
      for (const m of await hydrateClientCandidateProfiles(fbMatches as AnyRow[])) {
        queueNames.set(m.id as string, (m.candidate_profiles?.full_name as string) || "Candidate");
      }
    }

    for (const iv of completedList) {
      if (scoredInterviewIds.has(iv.id as string)) continue;
      const matchId = iv.candidate_match_id as string | null;
      const happenedAt =
        (iv.completed_at as string | null) ?? (iv.scheduled_at as string | null) ?? null;
      queueItems.push({
        key: `feedback:${iv.id}`,
        kind: "feedback",
        concerns: matchId ? (queueNames.get(matchId) ?? "Candidate") : "Candidate",
        role_title: titleByPosition.get(iv.position_id as string) ?? "Your role",
        position_id: (iv.position_id as string) ?? null,
        subject_id: matchId,
        due_at: happenedAt
          ? new Date(new Date(happenedAt).getTime() + 86_400_000).toISOString()
          : null,
        waiting_since: happenedAt,
        action: "Add feedback",
        to: "/client/interviews",
      });
    }

    // Missing-information requests from the recruiting team. Each one names the
    // exact brief field it needs, and leads to the role page where it can be
    // answered — never a contentless "your recruiter has a question".
    const { data: infoRequests } = await context.supabase
      .from("position_info_requests")
      .select("id, position_id, brief_field, question, created_at")
      .eq("organization_id", data.orgId)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(50);
    for (const r of (infoRequests as AnyRow[]) ?? []) {
      const field = briefField(r.brief_field as string);
      const positionId = (r.position_id as string) ?? null;
      queueItems.push({
        key: `info:${r.id}`,
        kind: "info_request",
        concerns: field ? `${field.label} — needed to keep sourcing` : (r.question as string),
        role_title: positionId ? (titleByPosition.get(positionId) ?? "Your role") : "Your account",
        position_id: positionId,
        subject_id: null,
        due_at: null,
        waiting_since: (r.created_at as string) ?? null,
        action: "Answer",
        to: positionId ? `/client/positions/${positionId}#information-needed` : "/client/approvals",
      });
    }

    // Ordered, deduped and grouped once, on the server, so every surface that
    // reads this payload sees the same queue.
    const queueGroups = buildQueue(queueItems);
    const decision_queue = [...queueGroups.overdue, ...queueGroups.upcoming];
    const decision_queue_meta = {
      /** How many candidates, interviews, offers and requests were examined. */
      checked: rows.length + completedList.length + ((infoRequests as AnyRow[]) ?? []).length,
      overdue: queueGroups.overdue.length,
      /** Nearest promised first-shortlist date still ahead of us. */
      next_expected_at:
        Array.from(promisedByPosition.values())
          .filter((ms) => ms > nowMs)
          .sort((a, b) => a - b)
          .map((ms) => new Date(ms).toISOString())[0] ?? null,
    };

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
    let senderLabels: Record<string, string> = {};
    if (recentMessageRows.length > 0) {
      const senderIds = [
        ...new Set(
          recentMessageRows
            .map((m) => (m.sender_user_id as string | null) ?? null)
            .filter((v): v is string => !!v),
        ),
      ];
      if (senderIds.length > 0) {
        // Teammates' and staff profiles are not all readable under the caller's
        // RLS, so names are resolved privileged — names only, nothing else.
        const { supabaseAdmin: nameDb } = await import("@/integrations/supabase/client.server");
        const { data: senderProfiles } = await (nameDb as AnyRow)
          .from("profiles")
          .select("auth_user_id, full_name, email")
          .in("auth_user_id", senderIds);
        for (const p of (senderProfiles as AnyRow[] | undefined) ?? []) {
          const id = p.auth_user_id as string;
          senderLabels[id] =
            ((p.full_name as string | null) ?? null) ||
            ((p.email as string | null) ?? null) ||
            "Teammate";
        }
      }
    }
    const recent_messages = recentMessageRows.map((m) => {
      const sid = (m.sender_user_id as string | null) ?? null;
      return {
        ...m,
        sender_name: !sid
          ? "TaaSFlow"
          : sid === context.userId
            ? "You"
            : (senderLabels[sid] ?? "Teammate"),
        mine: sid === context.userId,
      };
    });


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

      active_positions: activePositions,
      new_this_week,
      action_required,
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
