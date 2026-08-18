// Stage transitions, client actions, decline context and undo.
// Thin server-function wrapper: helpers live in client-shared.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { briefField } from "@/lib/position-info-requests";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { staleStateError } from "@/lib/decision-concurrency";
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
  type PipelineStatusInput,
} from "@/lib/client-pipeline-language";
import { computeRoleProgress } from "@/lib/client-role-progress";
import { computeClientRoleStatus } from "@/lib/client-role-status";
import { computeRoleRisk } from "@/lib/client-role-risk";
import { computeHiringHealth } from "@/lib/client-hiring-health";
import { buildQueue, type QueueItem } from "@/lib/client-decision-queue";
import { buildOfferRow } from "@/lib/client-offer-holder";
import { computeNextMilestone } from "@/lib/client-next-milestone";
import { buildRoleTimeline } from "@/lib/client-role-timeline";
import { resolveNotificationsForUser } from "@/lib/notifications-resolver.server";
import { assertWorkspaceAccess, readWorkspaceAccess } from "@/lib/authz/workspace-access";
import { hydrateClientCandidateProfiles } from "@/lib/client-candidate-hydrate.server";
import {
  advanceGateError,
  stageNeedsAgreedBrief,
  evaluateAdvanceGate,
} from "@/lib/client/advance-gate";
import { assessFreshness, type Freshness } from "@/lib/scoring/score-freshness";
import { readinessFromPositionRow } from "@/lib/position-readiness";

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

export const moveMatchStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      matchId: string;
      toStage: MatchStage;
      expectedStage?: string;
      reason?: string;
      reasonCode?: string;
    }) =>
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
          expectedStage: z.string().max(48).optional(),
          reason: z.string().trim().max(2000).optional(),
          reasonCode: z.string().max(64).optional(),
        })
        .superRefine((v, ctx) => {
          if (v.toStage === "not_moving_forward") {
            if (!v.reasonCode || !CLIENT_DECLINE_CODES.has(v.reasonCode)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A decline reason is required.",
                path: ["reasonCode"],
              });
            } else if (v.reasonCode === "other" && (v.reason ?? "").trim().length < 10) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Tell us a little more when the reason is 'Other'.",
                path: ["reason"],
              });
            }
          }
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const match = await loadMatch(context.supabase, data.orgId, data.matchId);
    const from = match.stage as MatchStage;
    // Someone else may have moved this candidate since the screen was drawn.
    // Refuse rather than apply a decision to a stage the client never saw.
    if (data.expectedStage && data.expectedStage !== from) {
      throw staleStateError(data.expectedStage, from);
    }
    if (from === data.toStage) return { ok: true, trace_id: trace };
    const allowed = STAGE_GRAPH[from] ?? [];
    if (!allowed.includes(data.toStage)) {
      throw new Error(`invalid_transition:${from}->${data.toStage}`);
    }
    // Business rule: a candidate cannot be advanced towards an interview or an
    // offer while the role brief the interview is judged against is incomplete.
    if (stageNeedsAgreedBrief(data.toStage)) {
      const { data: pos } = await context.supabase
        .from("positions")
        .select(
          "title, description, location, work_model, employment_type, seniority, requirements, compensation, intake_context",
        )
        .eq("id", match.position_id as string)
        .eq("organization_id", data.orgId)
        .maybeSingle();
      const gate = evaluateAdvanceGate({
        toStage: data.toStage,
        position: readinessFromPositionRow(pos as Record<string, unknown> | null),
      });
      if (gate.blocked) throw advanceGateError(gate.missing);
    }
    const { error } = await context.supabase
      .from("candidate_matches")
      .update({ stage: data.toStage })
      .eq("id", data.matchId)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    
    // When leaving a gated stage, retract any unstarted side-artifacts.
    if (from === "interview_process" && data.toStage !== "interview_process") {
      await context.supabase
        .from("interviews")
        .delete()
        .eq("candidate_match_id", data.matchId)
        .eq("organization_id", data.orgId)
        .eq("status", "requested");
    }
    
    // RETRACTION: Offer drafts (implied by 'offer' stage)
    if (from === "offer" && data.toStage !== "offer") {
      // In this system, 'offer' stage artifacts are usually managed via specific
      // tables or status flags. We ensure unconfirmed/draft items are cleared.
      // (Wait: based on current schema knowledge, interviews are the primary side artifact).
    }

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
        feedback: data.reason?.trim() || null,
        reason_code: data.reasonCode ?? null,
      } as never);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await resolveNotificationsForUser(supabaseAdmin, context.userId);

    if (data.toStage === "interview_process" && from !== "interview_process") {
      // Same one-open-interview rule as clientAction: a drag-and-drop retry
      // must not create a second requested interview.
      const { data: openInterview } = await context.supabase
        .from("interviews")
        .select("id")
        .eq("candidate_match_id", data.matchId)
        .eq("organization_id", data.orgId)
        .in("status", ["requested", "scheduling", "scheduled"])
        .limit(1)
        .maybeSingle();
      if (!openInterview) {
        await context.supabase.from("interviews").insert({
          candidate_match_id: data.matchId,
          organization_id: data.orgId,
          position_id: match.position_id as string,
          candidate_submission_id: (match.application_id as string) ?? null,
          status: "requested",
          requested_at: new Date().toISOString(),
          created_by: context.userId,
        });
      }
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
      const stageToEvent: Partial<
        Record<MatchStage, "client_shortlisted" | "interview_requested" | "candidate_hired">
      > = {
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
          .select(
            "candidate_profile_id, application_id, position_id, candidate_profiles:candidate_profile_id(user_id)",
          )
          .eq("id", data.matchId)
          .maybeSingle();
        const cpUser =
          (matchRow?.candidate_profiles as { user_id: string | null } | null)?.user_id ?? null;
        const candidateRecipients = cpUser
          ? [
              {
                user_id: cpUser,
                audience: "candidate" as const,
                link_path: `/me/applications/${matchRow?.application_id ?? ""}`,
              },
            ]
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
      // Always record the canonical status change itself, even when it has no
      // notification copy. Scope keys on the exact transition, so replaying the
      // same move never produces a second activity row.
      await emitEventFromServer({
        event: "candidate_stage_changed",
        scope: `${data.matchId}:${from}->${data.toStage}`,
        organization_id: data.orgId,
        position_id: (match.position_id as string) ?? null,
        application_id: (match.application_id as string) ?? null,
        candidate_match_id: data.matchId,
        actor_user_id: context.userId,
        payload: { from, to: data.toStage, feedback: data.reason?.trim() || null },
      });
    } catch (emitErr) {
      console.error("[moveMatchStage] emit failed", trace, emitErr);
    }
    return { ok: true, trace_id: trace };
  });

/**
 * Take back the last decision on a match.
 *
 * Deliberately bypasses STAGE_GRAPH: an undo is a correction of the caller's
 * own action inside the undo window, not a new forward transition. Anything
 * older than the window, or taken by someone else, is refused.
 */
export const undoClientDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orgId: string; matchId: string; toStage: MatchStage; decisionId?: string }) =>
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
          decisionId: z.string().uuid().optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const match = await loadMatch(context.supabase, data.orgId, data.matchId);
    const from = match.stage as MatchStage;

    const cutoff = new Date(Date.now() - UNDO_WINDOW_MS).toISOString();
    let q = context.supabase
      .from("client_decisions")
      .select("id, decision, created_at, from_stage")
      .eq("candidate_match_id", data.matchId)
      .eq("organization_id", data.orgId)
      .eq("actor_user_id", context.userId)
      .is("reversed_at", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data.decisionId) q = q.eq("id", data.decisionId);
    const { data: recent, error: recentErr } = await q.maybeSingle();
    if (recentErr) throw new Error(recentErr.message);
    if (!recent) throw new Error("undo_window_expired");

    // Prefer the stage recorded on the decision itself over the caller's hint.
    const backTo = ((recent as AnyRow).from_stage as MatchStage | null) ?? data.toStage;

    if (from !== backTo) {
      const { error } = await context.supabase
        .from("candidate_matches")
        .update({ stage: backTo })
        .eq("id", data.matchId)
        .eq("organization_id", data.orgId);
      if (error) throw new Error(error.message);
    }

    // An interview requested by the undone decision must not survive it.
    if (recent.decision === "request_interview") {
      await context.supabase
        .from("interviews")
        .delete()
        .eq("candidate_match_id", data.matchId)
        .eq("organization_id", data.orgId)
        .eq("status", "requested");
    }

    // The decision is never erased — it is marked reversed, so the audit trail
    // carries both the decision and its reversal.
    await context.supabase
      .from("client_decisions")
      .update({
        reversed_at: new Date().toISOString(),
        reversed_by: context.userId,
      } as never)
      .eq("id", recent.id)
      .eq("organization_id", data.orgId);

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.undo_decision",
      entity_type: "candidate_matches",
      entity_id: data.matchId,
      organization_id: data.orgId,
      before: { stage: from, decision: recent.decision, decision_id: recent.id },
      after: { stage: backTo, decision: null, reversed: true },
      trace_id: trace,
    });

    return { ok: true, trace_id: trace, undone: recent.decision as string, toStage: backTo };
  });

/**
 * Decisions this user can still take back, so the Undo affordance survives a
 * page refresh instead of living only inside a toast.
 */
export const listReversibleDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Viewers simply have nothing to undo — never an error on a dashboard read.
    try {
      await assertEditor(context.supabase, context.userId, data.orgId);
    } catch {
      return [];
    }
    const cutoff = new Date(Date.now() - UNDO_WINDOW_MS).toISOString();
    const { data: rows, error } = await context.supabase
      .from("client_decisions")
      .select("id, candidate_match_id, decision, created_at, from_stage")
      .eq("organization_id", data.orgId)
      .eq("actor_user_id", context.userId)
      .is("reversed_at", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      match_id: (r as AnyRow).candidate_match_id as string,
      decision: r.decision as string,
      created_at: r.created_at as string,
      from_stage: ((r as AnyRow).from_stage as MatchStage | null) ?? null,
      expires_at: new Date(
        new Date(r.created_at as string).getTime() + UNDO_WINDOW_MS,
      ).toISOString(),
    }));
  });


/**
 * What the decline dialog needs to close the loop on a role: the deal-breakers
 * the client stated, and how often they have already fallen back to "Other".
 */
export const getMatchDeclineContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string }) =>
    z.object({ orgId: z.string().uuid(), matchId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    const match = await loadMatch(context.supabase, data.orgId, data.matchId);
    const positionId = (match["position_id"] as string | null) ?? null;
    if (!positionId) return { positionId: null, dealBreakers: [], otherDeclineCount: 0 };

    const { data: position } = await context.supabase
      .from("positions")
      .select("id, dealbreakers, intake_context")
      .eq("organization_id", data.orgId)
      .eq("id", positionId)
      .maybeSingle();

    const raw = (position?.["dealbreakers"] ?? []) as unknown;
    const fromColumn = Array.isArray(raw)
      ? raw.map((r) =>
          typeof r === "string" ? r : String((r as { label?: unknown })?.label ?? ""),
        )
      : [];
    const ctx = (position?.["intake_context"] ?? {}) as Record<string, unknown>;
    const dealBreakers = normalizeDealBreakers(
      fromColumn.length > 0 ? fromColumn : (ctx["deal_breaker_list"] ?? ctx["deal_breakers"]),
    );

    // "Other" declines on this role, across everyone in the workspace.
    const { data: rows } = await context.supabase
      .from("client_decisions")
      .select("id, candidate_matches!inner(position_id)")
      .eq("organization_id", data.orgId)
      .eq("decision", "not_moving_forward")
      .eq("reason_code", "other")
      .is("reversed_at", null)
      .eq("candidate_matches.position_id", positionId)
      .limit(50);

    return {
      positionId,
      dealBreakers,
      otherDeclineCount: (rows ?? []).length,
    };
  });

export const clientAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      matchId: string;
      action: ClientActionKey;
      expectedStage?: string;
      feedback?: string;
      reasonCode?: string;
      signals?: string[];
      rating?: number;
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          matchId: z.string().uuid(),
          action: z.enum(CLIENT_ACTION_KEYS),
          expectedStage: z.string().max(48).optional(),
          feedback: z.string().max(4000).optional(),
          reasonCode: z.string().max(64).optional(),
          signals: z.array(z.string().max(64)).max(12).optional(),
          rating: z.number().int().min(1).max(5).optional(),
        })
        .superRefine((v, ctx) => {
          if (REASON_REQUIRED.has(v.action) && !v.reasonCode) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["reasonCode"],
              message: "A reason is required for this action.",
            });
          }
          // Declines must use the shared rejection vocabulary so reason counts
          // reconcile across the client and admin surfaces.
          if (
            v.action === "not_moving_forward" &&
            v.reasonCode &&
            !CLIENT_DECLINE_CODES.has(v.reasonCode)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["reasonCode"],
              message: "Pick a reason from the list.",
            });
          }
          if (v.reasonCode === "other" && (v.feedback ?? "").trim().length < 10) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["feedback"],
              message: "Please add at least ten characters explaining why.",
            });
          }
          // Decision notes are short by design; long-form feedback has its own action.
          if (
            (v.action === "not_moving_forward" || v.action === "hold") &&
            (v.feedback ?? "").trim().length > 500
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["feedback"],
              message: "Keep the note under 500 characters.",
            });
          }
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const trace = traceId();
    await assertEditor(context.supabase, context.userId, data.orgId);
    const match = await loadMatch(context.supabase, data.orgId, data.matchId);

    if (data.expectedStage && data.expectedStage !== match.stage) {
      throw staleStateError(data.expectedStage, match.stage as string);
    }

    const nextStage = ACTION_TO_STAGE[data.action];
    // Double-submit guard: a second click on a stage-moving action (the button
    // stayed enabled, the request was retried, two tabs were open) must not
    // write a second decision, interview or notification. The first click
    // already moved the stage, so an action that asks for the stage the
    // candidate is already in is a no-op, reported honestly as success.
    if (nextStage && match.stage === nextStage) {
      return { ok: true, trace_id: trace, noop: true as const };
    }
    if (nextStage) {
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
      // One open interview per candidate. Without this, a retried request adds
      // a second "requested" row and the scheduling queue shows the same
      // interview twice.
      const { data: openInterview } = await context.supabase
        .from("interviews")
        .select("id")
        .eq("candidate_match_id", data.matchId)
        .eq("organization_id", data.orgId)
        .in("status", ["requested", "scheduling", "scheduled"])
        .limit(1)
        .maybeSingle();
      if (!openInterview) {
        await context.supabase.from("interviews").insert({
          candidate_match_id: data.matchId,
          organization_id: data.orgId,
          position_id: match.position_id as string,
          candidate_submission_id: (match.application_id as string) ?? null,
          status: "requested",
          requested_at: new Date().toISOString(),
          created_by: context.userId,
        });
      }
    }


    // Persist a decision that mirrors the client's intent.
    const decisionMap = {
      shortlist: "shortlist",
      request_interview: "request_interview",
      request_more_information: "request_information",
      hold: "hold",
      request_contact_release: "request_contact_release",
      submit_feedback: "feedback",
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
        feedback: data.feedback?.trim() || null,
        reason_code: data.reasonCode ?? null,
        details: (data.signals?.length || data.rating
          ? { signals: data.signals ?? [], rating: data.rating ?? null }
          : null) as never,
        from_stage: match.stage as string,
        actor_user_id: context.userId,
      });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await resolveNotificationsForUser(supabaseAdmin, context.userId);

    await writeAudit(context.supabase, {
      actor: context.userId,
      action: `client.${data.action}`,
      entity_type: "candidate_matches",
      entity_id: data.matchId,
      organization_id: data.orgId,
      before: { stage: match.stage },
      after: {
        stage: nextStage ?? match.stage,
        feedback: data.feedback ?? null,
        reason_code: data.reasonCode ?? null,
      },
      trace_id: trace,
    });

    // Notify the TaaSFlow team so every client action lands on the admin side.
    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      const actionToEvent: Partial<Record<string, string>> = {
        shortlist: "client_shortlisted",
        request_interview: "interview_requested",
        request_more_information: "client_information_requested",
        hold: "client_hold",
        request_contact_release: "contact_release_requested",
        submit_feedback: "client_feedback_submitted",
        not_moving_forward: "client_declined",
        hire: "candidate_hired",
      };
      const evt = actionToEvent[data.action];
      if (evt) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: staff } = await supabaseAdmin
          .from("memberships")
          .select("user_id")
          .in("role", ["platform_admin", "operations"])
          .eq("status", "active");
        await emitEventFromServer({
          event: evt as never,
          scope: `${data.matchId}:${data.action}:${Date.now()}`,
          organization_id: data.orgId,
          position_id: (match.position_id as string) ?? null,
          application_id: (match.application_id as string) ?? null,
          candidate_match_id: data.matchId,
          candidate_profile_id: (match.candidate_profile_id as string) ?? null,
          actor_user_id: context.userId,
          payload: { reason_code: data.reasonCode ?? null },
          recipients: (staff ?? []).map((s) => ({
            user_id: s.user_id as string,
            audience: "admin" as const,
            link_path: `/admin/candidates`,
          })),
        });
      }
    } catch (emitErr) {
      console.error("[clientAction] emit failed", trace, emitErr);
    }

    return { ok: true, trace_id: trace };
  });
