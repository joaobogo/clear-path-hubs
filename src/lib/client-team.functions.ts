// Team roster and membership mutations.
// Thin server-function wrapper: helpers live in client-shared.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { briefField } from "@/lib/position-info-requests";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CLIENT_PERMISSIONS, type ClientPermission } from "@/lib/authz";
import { computeRoleLaunchState } from "@/lib/role-launch.server";
import {
  assertSeatAvailable,
  evaluateSeatBlock,
  recordSeatBlockAudit,
} from "@/lib/client-team-seats.server";
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
  assertWorkspaceTeamAccess,
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

export const getClientTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // One canonical access resolution: membership, role and staff flag all come
    // from the shared helper, which also handles archived workspaces and staff.
    await assertWorkspaceTeamAccess(context.supabase, context.userId, data.orgId);

    // After authorization, use the privileged server client for the roster so
    // organization-row visibility cannot make an authorized team appear broken.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("memberships")
      .select("user_id, role, status, created_at, profiles:user_id(full_name, email)")
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return (rows as AnyRow[]) ?? [];
  });

export const inviteClientMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      email: string;
      role: "client_admin" | "client_editor" | "client_viewer";
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          email: z
            .string()
            .email()
            .max(200)
            .transform((s) => s.trim().toLowerCase()),
          role: clientMemberRoleZ,
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertSeatAvailable(data.orgId);


    // Resolve the person first: if they are already on this team we say so
    // without sending them another email.
    let authUserId: string | null = null;
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("auth_user_id")
      .eq("email", data.email)
      .maybeSingle();

    if (existingProfile?.auth_user_id) {
      authUserId = existingProfile.auth_user_id;
      const { data: existing } = await supabaseAdmin
        .from("memberships")
        .select("id, status")
        .eq("organization_id", data.orgId)
        .eq("user_id", authUserId)
        .maybeSingle();
      if (existing) {
        if (existing.status === "removed") {
          const { error: uErr } = await supabaseAdmin
            .from("memberships")
            .update({ status: "invited", role: data.role })
            .eq("id", existing.id);
          if (uErr) throw new Error(uErr.message);
          return { ok: true, reactivated: true };
        }
        throw new Error(
          existing.status === "invited"
            ? `${data.email} already has a pending invitation to this workspace — resend it from their row instead.`
            : `${data.email} is already a member of this workspace.`,
        );
      }
    } else {
      const { data: invite, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
        { data: { invited_org_id: data.orgId } },
      );
      if (invErr || !invite?.user?.id)
        throw new Error(
          invErr?.message
            ? `We couldn't email that address: ${invErr.message}`
            : "We couldn't send that invitation. Check the email address and try again.",
        );
      authUserId = invite.user.id;
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { auth_user_id: authUserId, email: data.email, status: "active" },
          { onConflict: "auth_user_id" },
        );
    }


    const { error: mErr } = await supabaseAdmin.from("memberships").insert({
      user_id: authUserId,
      organization_id: data.orgId,
      role: data.role,
      status: "invited",
    });
    if (mErr) throw new Error(mErr.message);
    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      await emitEventFromServer({
        event: "member_invited",
        scope: `member:${data.orgId}:${authUserId}:invited`,
        organization_id: data.orgId,
        actor_user_id: context.userId,
        link_path: "/client/account?tab=team",
        payload: { role: data.role },
      });
    } catch (e) {
      console.error("[inviteClientMember] emit failed", e);
    }
    return { ok: true };
  });

export const resendClientInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; userId: string }) =>
    z.object({ orgId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("auth_user_id", data.userId)
      .maybeSingle();
    if (!profile?.email) throw new Error("Member email not found");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(profile.email, {
      data: { invited_org_id: data.orgId },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateClientMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orgId: string;
      userId: string;
      role: "client_admin" | "client_editor" | "client_viewer";
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          userId: z.string().uuid(),
          role: clientMemberRoleZ,
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    // Prevent removing the last admin.
    if (data.role !== "client_admin") {
      const { data: admins } = await context.supabase
        .from("memberships")
        .select("user_id")
        .eq("organization_id", data.orgId)
        .eq("role", "client_admin")
        .eq("status", "active");
      const adminIds = new Set(((admins as AnyRow[]) ?? []).map((a) => a.user_id));
      adminIds.delete(data.userId);
      if (adminIds.size === 0) throw new Error("You need at least one Admin — promote someone else first.");
    }
    const { error } = await context.supabase
      .from("memberships")
      .update({ role: data.role })
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setClientMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; userId: string; status: "active" | "suspended" }) =>
    z
      .object({
        orgId: z.string().uuid(),
        userId: z.string().uuid(),
        status: z.enum(["active", "suspended"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    if (data.status === "suspended") {
      const { data: admins } = await context.supabase
        .from("memberships")
        .select("user_id, role")
        .eq("organization_id", data.orgId)
        .eq("status", "active");
      const activeAdmins = ((admins as AnyRow[]) ?? []).filter(
        (a) => a.role === "client_admin" && a.user_id !== data.userId,
      );
      if (activeAdmins.length === 0)
        throw new Error("You need at least one active Admin — promote someone else first.");
    }
    // Reactivating a suspended teammate consumes a seat just like an
    // invitation does. Instead of throwing (which forces the UI to string-match
    // trigger text and quote its own cached counts), return a structured reason
    // code with the counts the server measured. The database guard is still the
    // real boundary behind this.
    if (data.status === "active") {
      const seatBlock = await evaluateSeatBlock(data.orgId);
      if (seatBlock) {
        // Record which seat condition refused this, before answering.
        await recordSeatBlockAudit({
          orgId: data.orgId,
          actorUserId: context.userId,
          targetUserId: data.userId,
          block: seatBlock,
        });
        return { ok: false as const, seatBlock };
      }
    }

    const { error } = await context.supabase
      .from("memberships")
      .update({ status: data.status })
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeClientMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; userId: string }) =>
    z.object({ orgId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    await assertNotSupportViewReadOnly(context.supabase, context.userId, data.orgId);
    if (data.userId === context.userId) throw new Error("You can't remove yourself.");
    const { data: admins } = await context.supabase
      .from("memberships")
      .select("user_id, role")
      .eq("organization_id", data.orgId)
      .eq("status", "active");
    const others = ((admins as AnyRow[]) ?? []).filter(
      (a) => a.role === "client_admin" && a.user_id !== data.userId,
    );
    if (others.length === 0)
      throw new Error("You need at least one workspace admin before removing this member.");
    // Soft-remove: preserves auth user + audit trail.
    const { error } = await context.supabase
      .from("memberships")
      .update({ status: "removed" })
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      await emitEventFromServer({
        event: "member_removed",
        scope: `member:${data.orgId}:${data.userId}:removed`,
        organization_id: data.orgId,
        actor_user_id: context.userId,
        link_path: "/client/account?tab=team",
      });
    } catch (e) {
      console.error("[removeClientMember] emit failed", e);
    }
    return { ok: true };
  });
