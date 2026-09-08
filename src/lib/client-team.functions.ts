// Team roster and membership mutations.
// Thin server-function wrapper: helpers live in client-shared.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { assertNoQaContamination } from "@/lib/qa-guard";
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
  assertWorkspaceTeamView,
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
    // View gate, not manage: staff in org-preview may read the roster (P25
    // keeps every mutation below on the manage gate).
    await assertWorkspaceTeamView(context.supabase, context.userId, data.orgId);

    // After authorization, use the privileged server client for the roster so
    // organization-row visibility cannot make an authorized team appear broken.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("memberships")
      .select("user_id, role, status, created_at")
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);

    // memberships.user_id points at the auth user, so profiles are resolved in a
    // second read instead of a PostgREST embed (there is no FK between them).
    const memberships = (rows as AnyRow[]) ?? [];
    const userIds = Array.from(
      new Set(memberships.map((r) => r.user_id).filter(Boolean) as string[]),
    );
    const profileByUser = new Map<string, { full_name: string | null; email: string | null }>();
    if (userIds.length > 0) {
      const { data: profileRows } = await supabaseAdmin
        .from("profiles")
        .select("auth_user_id, full_name, email")
        .in("auth_user_id", userIds);
      for (const p of (profileRows as AnyRow[]) ?? []) {
        if (p.auth_user_id)
          profileByUser.set(p.auth_user_id as string, {
            full_name: (p.full_name as string | null) ?? null,
            email: (p.email as string | null) ?? null,
          });
      }
    }

    return memberships.map((r) => ({
      ...r,
      profiles: profileByUser.get(r.user_id as string) ?? null,
    })) as AnyRow[];
  });

/** What actually happened to the invitation email, so no caller can assume. */
export type InviteDelivery = { delivered: boolean; reason: string | null };

const ROLE_LABEL: Record<string, string> = {
  client_admin: "an admin",
  client_editor: "an editor",
  client_viewer: "a viewer",
};

/**
 * Send the invitation. ONE dispatch path, used by every exit of
 * `inviteClientMember`.
 *
 * The invite had three ways to reserve a seat and report success while
 * emailing nobody (audit #9, item 22 — the auditor's invite reserved a seat,
 * toasted "Invitation sent", and never arrived):
 *
 *  1. Re-inviting someone previously removed flipped the membership back to
 *     `invited` and returned early, above every line of email code.
 *  2. An address the provider refuses comes back from `sendTemplateEmail` as
 *     `{ sent: false, reason: "recipient_suppressed" }` — a RETURN, not a
 *     throw — and the result was discarded, so the catch never ran.
 *  3. An address that already had an auth user got no action link at all
 *     (`generateLink` is only called in the new-user branch), so it fell to
 *     `inviteUserByEmail`, which fails for an already-registered address.
 *
 * Whatever happens here is reported back to the caller rather than swallowed.
 * Never throws: a seat that exists with no email is recoverable by resending,
 * while an exception would leave the membership half-created.
 */
async function deliverTeamInvite(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any;
  orgId: string;
  email: string;
  role: "client_admin" | "client_editor" | "client_viewer";
  actorUserId: string;
  /** A link already minted upstream; otherwise one is minted here. */
  actionUrl?: string | null;
  /** Invite links only work for NEW users; an existing one needs a magic link. */
  userExists: boolean;
}): Promise<InviteDelivery> {
  const { supabaseAdmin } = args;
  let actionUrl = args.actionUrl ?? null;

  if (!actionUrl) {
    try {
      const { data: link } = await supabaseAdmin.auth.admin.generateLink({
        type: args.userExists ? "magiclink" : "invite",
        email: args.email,
        options: { data: { invited_org_id: args.orgId } },
      });
      actionUrl = link?.properties?.action_link ?? link?.action_link ?? null;
    } catch (e) {
      console.error("[deliverTeamInvite] generateLink failed", e);
    }
  }

  if (actionUrl) {
    try {
      const [{ data: org }, { data: inviter }] = await Promise.all([
        supabaseAdmin.from("organizations").select("name").eq("id", args.orgId).maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("auth_user_id", args.actorUserId)
          .maybeSingle(),
      ]);
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      // The RESULT is checked. `sendTemplateEmail` returns `{ sent: false }`
      // for a suppressed recipient instead of throwing.
      const res = await sendTemplateEmail("team-invite", args.email, {
        templateData: {
          inviterName: (inviter?.full_name as string | null) ?? null,
          workspaceName: (org?.name as string | null) ?? null,
          roleLabel: ROLE_LABEL[args.role] ?? "a member",
          actionUrl,
        },
      });
      if (res?.sent) return { delivered: true, reason: null };
      console.error("[deliverTeamInvite] provider did not send", res?.reason);
      return { delivered: false, reason: res?.reason ?? "not_sent" };
    } catch (e) {
      console.error("[deliverTeamInvite] branded invitation failed, falling back", e);
    }
  }

  // Fallback: Supabase's own plainer invitation. Only meaningful for an
  // address with no auth user — it errors for one that already exists.
  if (!args.userExists) {
    try {
      await supabaseAdmin.auth.admin.inviteUserByEmail(args.email, {
        data: { invited_org_id: args.orgId },
      });
      return { delivered: true, reason: "fallback_supabase_invite" };
    } catch (e) {
      console.error("[deliverTeamInvite] fallback invitation failed", e);
      return { delivered: false, reason: e instanceof Error ? e.message : "send_failed" };
    }
  }
  return { delivered: false, reason: actionUrl ? "send_failed" : "no_action_link" };
}

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

    const qa = await assertNoQaContamination(context.supabase, data.orgId, [
      data.email,
    ]);
    if (!qa.ok) throw new Error(qa.reason ?? "Invalid input");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await assertSeatAvailable(data.orgId);


    // Resolve the person first: if they are already on this team we say so
    // without sending them another email.
    let authUserId: string | null = null;
    /** Supabase action link — where the invitee sets their password. */
    let inviteActionUrl: string | null = null;
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
          // Re-inviting is still inviting. This used to return here, above
          // every line of email code, so the seat came back and the person was
          // never told (audit #9, item 22).
          const delivery = await deliverTeamInvite({
            supabaseAdmin,
            orgId: data.orgId,
            email: data.email,
            role: data.role,
            actorUserId: context.userId,
            userExists: true,
          });
          return {
            ok: true,
            reactivated: true,
            emailDelivered: delivery.delivered,
            deliveryReason: delivery.reason,
          };
        }
        throw new Error(
          existing.status === "invited"
            ? `${data.email} already has a pending invitation to this workspace — resend it from their row instead.`
            : `${data.email} is already a member of this workspace.`,
        );
      }
    } else {
      // generateLink rather than inviteUserByEmail: it creates the account and
      // returns the action link WITHOUT sending Supabase's own message, so the
      // invitation can be sent from here with the sender's name and the
      // workspace on it. Supabase auth templates cannot carry custom variables,
      // which is why the previous invitation could only say "You've been
      // invited to TaaSFlow" — an anonymous email that reads like something to
      // ignore, to people who have usually been told to expect it by name.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invite, error: invErr } = await (supabaseAdmin as any).auth.admin.generateLink({
        type: "invite",
        email: data.email,
        options: { data: { invited_org_id: data.orgId } },
      });
      if (invErr || !invite?.user?.id)
        throw new Error(
          invErr?.message
            ? `We couldn't email that address: ${invErr.message}`
            : "We couldn't send that invitation. Check the email address and try again.",
        );
      authUserId = invite.user.id;
      inviteActionUrl =
        invite?.properties?.action_link ?? invite?.action_link ?? null;
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { auth_user_id: authUserId!, email: data.email, status: "active" },
          { onConflict: "auth_user_id" },
        );
    }


    const { error: mErr } = await supabaseAdmin.from("memberships").insert({
      user_id: authUserId!,
      organization_id: data.orgId,
      role: data.role,
      status: "invited",
    });
    if (mErr) throw new Error(mErr.message);

    // The invitation itself: named sender, named workspace, and the link that
    // lets them choose a password. One path, whether or not this address
    // already had an auth user, and the outcome is returned rather than
    // assumed.
    const delivery = await deliverTeamInvite({
      supabaseAdmin,
      orgId: data.orgId,
      email: data.email,
      role: data.role,
      actorUserId: context.userId,
      actionUrl: inviteActionUrl,
      userExists: Boolean(existingProfile?.auth_user_id),
    });

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
    // The caller is told whether the person was actually emailed. "Invitation
    // sent" over a seat nobody was told about is the defect this returns.
    return {
      ok: true,
      emailDelivered: delivery.delivered,
      deliveryReason: delivery.reason,
    };
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
    // Confirm the write actually landed. Row-level rules can silently match no
    // rows, and reporting "Role updated" for a write that never happened is
    // worse than an error.
    const { data: updated, error } = await context.supabase
      .from("memberships")
      .update({ role: data.role })
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId)
      .select("user_id, role");
    if (error) throw new Error(error.message);
    if (!((updated as AnyRow[]) ?? []).length) {
      throw new Error("We could not update that member's role. Refresh and try again.");
    }
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

    const { data: updated, error } = await context.supabase
      .from("memberships")
      .update({ status: data.status })
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId)
      .select("user_id");
    if (error) throw new Error(error.message);
    if (!((updated as AnyRow[]) ?? []).length) {
      throw new Error("We could not update that member. Refresh and try again.");
    }
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
    const { data: removed, error } = await context.supabase
      .from("memberships")
      .update({ status: "removed" })
      .eq("organization_id", data.orgId)
      .eq("user_id", data.userId)
      .select("user_id");
    if (error) throw new Error(error.message);
    if (!((removed as AnyRow[]) ?? []).length) {
      throw new Error("We could not remove that member. Refresh and try again.");
    }
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
