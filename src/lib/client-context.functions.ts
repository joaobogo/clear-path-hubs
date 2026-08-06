// Workspace context, branding and onboarding state.
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

export const getClientContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { orgId?: string }) => input ?? {})
  .handler(async ({ context, data }) => {
    const { active, memberships, isStaff } = await resolveContext(
      context.supabase,
      context.userId,
      data.orgId,
    );
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("full_name, timezone, client_onboarding_dismissed_at")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    const onboarding = {
      dismissed_at:
        (prof as { client_onboarding_dismissed_at?: string | null } | null)
          ?.client_onboarding_dismissed_at ?? null,
      timezone: (prof as { timezone?: string | null } | null)?.timezone ?? null,
      display_name: (prof as { full_name?: string | null } | null)?.full_name ?? null,
    };
    if (!active) {
      return {
        active: null as null | {
          organization_id: string;
          role: ClientRole;
          name: string;
          industry: string | null;
          parent_organization_id: string | null;
          logo_url: string | null;
          brand_display_name: string | null;
          brand_primary_color: string | null;
          brand_accent_color: string | null;
          parent_name: string | null;
          permissions: ClientPermission[];
        },

        organizations: memberships.map((m) => ({
          id: m.organization_id,
          role: m.role as ClientRole,
          name: m.organizations?.name ?? "Organization",
        })),
        isStaff,
        onboarding,
      };
    }
    const parentId = (active.organizations?.parent_organization_id ?? null) as string | null;
    let parentName: string | null = null;
    if (parentId) {
      const { data: parentOrg } = await context.supabase
        .from("organizations")
        .select("name")
        .eq("id", parentId)
        .maybeSingle();
      parentName = (parentOrg as { name?: string | null } | null)?.name ?? null;
    }
    return {
      active: {
        organization_id: active.organization_id,
        role: active.role as ClientRole,
        name: active.organizations?.name ?? "Organization",
        industry: (active.organizations?.industry ?? null) as string | null,
        parent_organization_id: parentId,
        logo_url: (active.organizations?.logo_url ?? null) as string | null,
        brand_display_name: (active.organizations?.brand_display_name ?? null) as string | null,
        brand_primary_color: (active.organizations?.brand_primary_color ?? null) as string | null,
        brand_accent_color: (active.organizations?.brand_accent_color ?? null) as string | null,
        parent_name: parentName,
        // Server-verified seat permissions. UI uses these to hide controls;
        // RLS + server assertions independently enforce the same rules.
        permissions: (active.permissions ?? []) as ClientPermission[],
      },

      organizations: memberships.map((m) => ({
        id: m.organization_id,
        role: m.role as ClientRole,
        name: m.organizations?.name ?? "Organization",
      })),
      isStaff,
      onboarding,
    };
  });

export const dismissClientOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ client_onboarding_dismissed_at: new Date().toISOString() })
      .eq("auth_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const resetClientOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ client_onboarding_dismissed_at: null })
      .eq("auth_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateClientBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof brandingSchema>) => brandingSchema.parse(input))
  .handler(async ({ context, data }) => {
    // Must be a client_admin of this org (or platform staff).
    const access = await readWorkspaceAccess(context.supabase, context.userId, data.orgId);
    if (!access.isAdmin) {
      throw new Error("Only client admins can update branding.");
    }
    const { error } = await context.supabase
      .from("organizations")
      .update({
        logo_url: data.logo_url,
        brand_display_name: data.brand_display_name,
        brand_primary_color: data.brand_primary_color,
        brand_accent_color: data.brand_accent_color,
      })
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
