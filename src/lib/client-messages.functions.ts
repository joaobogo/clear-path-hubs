// Org-scoped workspace conversation with the TaaSFlow team.
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
    // The message row id is the natural idempotency scope: one message, one event.
    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      await emitEventFromServer({
        event: "message_sent",
        scope: `message:${(row as AnyRow).id}`,
        organization_id: data.orgId,
        actor_user_id: context.userId,
        link_path: "/client/messages",
      });
    } catch (e) {
      console.error("[sendClientMessage] emit failed", e);
    }
    return row as AnyRow;
  });
