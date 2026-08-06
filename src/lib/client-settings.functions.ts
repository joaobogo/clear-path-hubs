// Company profile, notification preferences and timezone.
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
import {
  assertWorkspaceAccess,
  assertWorkspaceWrite,
  readWorkspaceAccess,
} from "@/lib/authz/workspace-access";
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

export const getClientSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Tenant gate — canonical helper (active member or platform staff).
    const access = await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);

    const [{ data: org }, { data: prefs }, { data: profile }] = await Promise.all([
      context.supabase
        .from("organizations")
        .select(
          "id, name, website, industry, headquarters, phone, onboarding_status, dashboard_status, status",
        )
        .eq("id", data.orgId)
        .maybeSingle(),
      context.supabase
        .from("client_notification_preferences")
        .select("*")
        .eq("user_id", context.userId)
        .eq("organization_id", data.orgId)
        .maybeSingle(),
      context.supabase
        .from("profiles")
        .select("timezone, email, full_name")
        .eq("auth_user_id", context.userId)
        .maybeSingle(),
    ]);
    if (!org) throw new Error("Workspace not found");
    return {
      role: (access.role ?? "operations") as ClientRole,
      approved:
        (org as AnyRow).onboarding_status === "active" ||
        (org as AnyRow).dashboard_status === "active" ||
        (org as AnyRow).status === "active",
      company: {
        id: (org as AnyRow).id as string,
        name: (org as AnyRow).name as string,
        website: ((org as AnyRow).website as string | null) ?? "",
        industry: ((org as AnyRow).industry as string | null) ?? "",
        headquarters: ((org as AnyRow).headquarters as string | null) ?? "",
        phone: ((org as AnyRow).phone as string | null) ?? "",
      },
      notifications: {
        candidate_delivered:
          (prefs as AnyRow)?.candidate_delivered ?? notifPrefsShape.candidate_delivered,
        interview_request:
          (prefs as AnyRow)?.interview_request ?? notifPrefsShape.interview_request,
        new_message: (prefs as AnyRow)?.new_message ?? notifPrefsShape.new_message,
        offer_update: (prefs as AnyRow)?.offer_update ?? notifPrefsShape.offer_update,
        hire_update: (prefs as AnyRow)?.hire_update ?? notifPrefsShape.hire_update,
        email_enabled: (prefs as AnyRow)?.email_enabled ?? notifPrefsShape.email_enabled,
        digest: ((prefs as AnyRow)?.digest ?? notifPrefsShape.digest) as
          | "immediate"
          | "daily"
          | "off",
      },
      account: {
        email: ((profile as AnyRow)?.email as string | null) ?? "",
        full_name: ((profile as AnyRow)?.full_name as string | null) ?? "",
        timezone: ((profile as AnyRow)?.timezone as string | null) ?? "UTC",
      },
    };
  });

export const updateClientCompanyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof companyProfileZ>) => companyProfileZ.parse(input))
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    const trace_id = `st-cp-${crypto.randomUUID()}`;
    const { data: before } = await context.supabase
      .from("organizations")
      .select("name, website, industry, headquarters, phone")
      .eq("id", data.orgId)
      .maybeSingle();
    const patch = {
      name: data.name,
      website: data.website,
      industry: data.industry,
      headquarters: data.headquarters,
      phone: data.phone,
    };
    const { data: updated, error } = await context.supabase
      .from("organizations")
      .update(patch)
      .eq("id", data.orgId)
      .select("name, website, industry, headquarters, phone")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.settings.company_profile.update",
      entity_type: "organizations",
      entity_id: data.orgId,
      organization_id: data.orgId,
      before,
      after: updated,
      trace_id,
    });
    return { ok: true, company: updated };
  });

export const updateClientNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof notifPrefsZ>) => notifPrefsZ.parse(input))
  .handler(async ({ context, data }) => {
    // Access, role and the read-only viewer rule all come from one helper.
    await assertWorkspaceWrite(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);

    const trace_id = `st-np-${crypto.randomUUID()}`;
    const { data: before } = await context.supabase
      .from("client_notification_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    const row = {
      user_id: context.userId,
      organization_id: data.orgId,
      candidate_delivered: data.candidate_delivered,
      interview_request: data.interview_request,
      new_message: data.new_message,
      offer_update: data.offer_update,
      hire_update: data.hire_update,
      email_enabled: data.email_enabled,
      digest: data.digest,
    };
    const { data: after, error } = await context.supabase
      .from("client_notification_preferences")
      .upsert(row, { onConflict: "user_id,organization_id" })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.settings.notifications.update",
      entity_type: "client_notification_preferences",
      entity_id: `${context.userId}:${data.orgId}`,
      organization_id: data.orgId,
      before,
      after,
      trace_id,
    });
    return { ok: true, notifications: after };
  });

export const updateClientTimezone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; timezone: string }) =>
    z.object({ orgId: z.string().uuid() }).merge(timezoneZ).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceWrite(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);

    const trace_id = `st-tz-${crypto.randomUUID()}`;
    const { data: before } = await context.supabase
      .from("profiles")
      .select("timezone")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    const { data: after, error } = await context.supabase
      .from("profiles")
      .update({ timezone: data.timezone })
      .eq("auth_user_id", context.userId)
      .select("timezone")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await writeAudit(context.supabase, {
      actor: context.userId,
      action: "client.settings.timezone.update",
      entity_type: "profiles",
      entity_id: context.userId,
      organization_id: data.orgId,
      before,
      after,
      trace_id,
    });
    return { ok: true, timezone: (after as AnyRow)?.timezone as string };
  });
