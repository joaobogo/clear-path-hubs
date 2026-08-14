// Released candidate list and single candidate read.
// Thin server-function wrapper: helpers live in client-shared.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { briefField } from "@/lib/position-info-requests";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CLIENT_PERMISSIONS, type ClientPermission } from "@/lib/authz";
import { computeRoleLaunchState } from "@/lib/role-launch.server";
import { DECLINE_REASONS } from "@/lib/client-decision-reasons";
import { classifyBand } from "@/lib/scoring/bands";

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
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    // One select shared with the detail view: a slimmer list select silently
    // dropped positions.requirements, which emptied requirement coverage on
    // every card.
    let q = context.supabase
      .from("candidate_matches")
      .select(CLIENT_CANDIDATE_SELECT)
      .eq("organization_id", data.orgId)
      .eq("client_visibility", "visible");

    if (data.positionId) q = q.eq("position_id", data.positionId);

    const { data: rawRows, error } = await q.order("delivered_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = await hydrateClientCandidateProfiles(rawRows as AnyRow[]);

    // Verified, shareable evidence for the shortlist cards.
    const matchIds = ((rows as AnyRow[]) ?? []).map((r) => r.id as string);
    const evidenceByMatch = await loadClientEvidenceItems(context.supabase, matchIds);

    // Active interviews, same definition as the "Interviewing" KPI tile, so the
    // list can agree with the tile even before the stage is moved.
    const activeInterviews = new Set<string>();
    if (matchIds.length > 0) {
      const { data: ivs } = await context.supabase
        .from("interviews")
        .select("candidate_match_id")
        .in("candidate_match_id", matchIds)
        .in("status", ["requested", "scheduling", "scheduled", "completed"]);
      for (const iv of ((ivs as AnyRow[]) ?? [])) {
        if (iv.candidate_match_id) activeInterviews.add(iv.candidate_match_id as string);
      }
    }

    // Map to sanitized client-safe DTOs first — filters below operate on those.
    let dtos = ((rows as AnyRow[]) ?? []).map((r) =>
      toClientCandidateDTO({
        ...r,
        interview_active: activeInterviews.has(r.id as string),
        evidence_items: evidenceByMatch.get(r.id as string) ?? [],
      }),
    );

    if (data.filter && data.filter !== "all") {
      dtos = dtos.filter((d) => {
        if (data.filter === "new") return d.stage === "delivered";
        if (data.filter === "shortlisted") return d.stage === "shortlisted";
        if (data.filter === "hired") return d.stage === "hired";
        if (data.filter === "not_moving_forward") return d.stage === "not_moving_forward";
        if (data.filter === "interview")
          return d.interview_active || d.stage === "interview_process" || d.stage === "offer";
        // "Top" matches the Overview tile and the card band: derived from the
        // run's score, with the stored label only as a fallback.
        if (data.filter === "top")
          return d.score != null
            ? (TOP_FIT_LABELS as readonly string[]).includes(classifyBand(d.score))
            : d.fit_label != null && (TOP_FIT_LABELS as readonly string[]).includes(d.fit_label);
        return true;
      });
    }
    // Chip filter speaks the client-facing band shown on the card.
    if (data.fitBand) dtos = dtos.filter((d) => d.fit.band === data.fitBand || d.fit_label === data.fitBand);

    if (data.location) {
      const needle = data.location.toLowerCase();
      dtos = dtos.filter((d) => (d.candidate.location ?? "").toLowerCase().includes(needle));
    }

    return dtos;
  });

export const getClientCandidate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string; preview?: boolean }) =>
    z
      .object({
        orgId: z.string().uuid(),
        matchId: z.string().uuid(),
        preview: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const access = await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    // Staff previewing a candidate before publish must see the exact sanitized
    // DTO the client will get. Clients themselves never escape the visibility
    // filter — that gate is what keeps unpublished work internal.
    const staffPreview = data.preview === true && access.isStaff;
    let query = context.supabase
      .from("candidate_matches")
      .select(CLIENT_CANDIDATE_SELECT)

      .eq("organization_id", data.orgId)
      .eq("id", data.matchId);
    if (!staffPreview) query = query.eq("client_visibility", "visible");
    const { data: match, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!match) return null;

    const [hydratedMatch] = await hydrateClientCandidateProfiles([match as AnyRow]);

    const applicationId = (match as AnyRow).application_id;
    const candidateProfileId = (match as AnyRow).candidate_profile_id;
    const auditIds = [data.matchId, applicationId, candidateProfileId].filter(Boolean) as string[];
    const [{ data: interviews }, { data: decisions }, answersRes, auditRes] = await Promise.all([
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
      auditIds.length > 0
        ? context.supabase
            .from("audit_events")
            .select(
              "id, action, entity_type, entity_id, actor_user_id, before_state, after_state, created_at",
            )
            .eq("organization_id", data.orgId)
            .in("entity_id", auditIds)
            .order("created_at", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] as AnyRow[] }),
    ]);

    const answers = ((answersRes as AnyRow).data as AnyRow[]) ?? [];
    answers.sort(
      (a, b) =>
        (a.screening_questions?.display_order ?? 0) - (b.screening_questions?.display_order ?? 0),
    );
    const evidenceItems =
      (await loadClientEvidenceItems(context.supabase, [data.matchId])).get(data.matchId) ?? [];

    const ACTIVE_INTERVIEW_STATUSES = ["requested", "scheduling", "scheduled", "completed"];
    const matchWithAnswers = {
      ...(hydratedMatch as AnyRow),
      // Same definition as the list and the "Interviewing" KPI tile.
      interview_active: ((interviews as AnyRow[]) ?? []).some((iv) =>
        ACTIVE_INTERVIEW_STATUSES.includes(String(iv.status)),
      ),
      evidence_items: evidenceItems,
      application_answers: answers,
      audit_events: ((auditRes as AnyRow).data as AnyRow[]) ?? [],
    };

    return {
      candidate: toClientCandidateDTO(matchWithAnswers),
      interviews: (interviews as AnyRow[]) ?? [],
      decisions: (decisions as AnyRow[]) ?? [],
    };
  });

