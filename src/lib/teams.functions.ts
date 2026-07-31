import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Microsoft Teams workspace connection.
 *
 * A workspace admin points TaaSFlow at one Teams channel and chooses which
 * events land there. Nothing is posted until a channel is connected, and the
 * connection can be switched off at any time without losing the mapping.
 */

export const TEAMS_EVENT_CHOICES = [
  { value: "candidate_published", label: "New candidate delivered" },
  { value: "interview_scheduled", label: "Interview scheduled" },
  { value: "interview_cancelled", label: "Interview cancelled" },
  { value: "client_hold", label: "Candidate placed on hold" },
  { value: "client_declined", label: "Candidate declined" },
  { value: "position_activated", label: "Role went live" },
  { value: "message_sent", label: "New message on a role" },
  { value: "candidate_hired", label: "Hire confirmed" },
] as const;

const TEAMS_EVENT_VALUES = TEAMS_EVENT_CHOICES.map((c) => c.value) as [string, ...string[]];

async function assertOrgAdminOrStaff(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
  orgId: string,
) {
  const [{ data: admin }, { data: staff }] = await Promise.all([
    supabase.rpc("is_org_admin", { _org: orgId, _user: userId }),
    supabase.rpc("is_platform_staff", { _user: userId }),
  ]);
  if (admin !== true && staff !== true) throw new Error("Forbidden");
}

export const getTeamsConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase
      .from("teams_channel_links")
      .select("team_id, channel_id, channel_label, enabled, events, updated_at")
      .eq("organization_id", data.orgId)
      .maybeSingle();

    const { data: recent } = await context.supabase
      .from("teams_delivery_log")
      .select("event_type, status, error_code, created_at")
      .eq("organization_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      connection: row
        ? {
            team_id: row.team_id as string,
            channel_id: row.channel_id as string,
            channel_label: (row.channel_label as string | null) ?? "",
            enabled: row.enabled as boolean,
            events: (row.events as string[] | null) ?? [],
            updated_at: row.updated_at as string,
          }
        : null,
      recent: recent ?? [],
      choices: TEAMS_EVENT_CHOICES,
    };
  });

export const saveTeamsConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (raw: {
      orgId: string;
      teamId: string;
      channelId: string;
      channelLabel?: string;
      enabled: boolean;
      events: string[];
    }) =>
      z
        .object({
          orgId: z.string().uuid(),
          teamId: z.string().trim().min(4).max(200),
          channelId: z.string().trim().min(4).max(300),
          channelLabel: z.string().trim().max(120).optional(),
          enabled: z.boolean(),
          events: z.array(z.enum(TEAMS_EVENT_VALUES)).max(20),
        })
        .parse(raw),
  )
  .handler(async ({ context, data }) => {
    await assertOrgAdminOrStaff(context.supabase as never, context.userId, data.orgId);
    const { error } = await context.supabase.from("teams_channel_links").upsert(
      {
        organization_id: data.orgId,
        team_id: data.teamId,
        channel_id: data.channelId,
        channel_label: data.channelLabel ?? null,
        enabled: data.enabled,
        events: data.events,
        connected_by: context.userId,
      },
      { onConflict: "organization_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    await assertOrgAdminOrStaff(context.supabase as never, context.userId, data.orgId);
    const { error } = await context.supabase
      .from("teams_channel_links")
      .delete()
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTeamsTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    await assertOrgAdminOrStaff(context.supabase as never, context.userId, data.orgId);
    const { notifyOrgTeams } = await import("./teams-notify.server");
    const result = await notifyOrgTeams({
      organizationId: data.orgId,
      eventType: "candidate_published",
      notice: {
        title: "TaaSFlow is connected",
        subtitle: "Test message",
        facts: [{ label: "Sent by", value: "Workspace settings" }],
        linkPath: "/client",
        linkLabel: "Open your workspace",
      },
    });
    return result;
  });

/** Reads a Teams action link without consuming it (for the confirm screen). */
export const readTeamsActionLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { token: string }) =>
    z.object({ token: z.string().min(16).max(200) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashActionToken } = await import("./teams-notify.server");
    const { data: link } = await supabaseAdmin
      .from("teams_action_links")
      .select("id, organization_id, candidate_match_id, action, expires_at, used_at")
      .eq("token_hash", hashActionToken(data.token))
      .maybeSingle();

    if (!link) return { status: "invalid" as const };
    if (link.used_at) return { status: "used" as const };
    if (new Date(link.expires_at as string).getTime() < Date.now()) {
      return { status: "expired" as const };
    }

    // The signed-in person must be an editor in that workspace.
    const { data: member } = await context.supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", link.organization_id as string)
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    if (!member || member.role === "client_viewer") {
      return { status: "forbidden" as const };
    }

    const { data: match } = await supabaseAdmin
      .from("candidate_matches")
      .select("id, stage, position_id, positions:position_id(title)")
      .eq("id", link.candidate_match_id as string)
      .maybeSingle();

    return {
      status: "ready" as const,
      orgId: link.organization_id as string,
      matchId: link.candidate_match_id as string,
      action: link.action as string,
      stage: (match?.stage as string | null) ?? null,
      roleTitle:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((match as any)?.positions?.title as string | undefined) ?? "this role",
    };
  });

/** Marks a Teams action link as used. Called after the decision is written. */
export const consumeTeamsActionLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { token: string }) =>
    z.object({ token: z.string().min(16).max(200) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashActionToken } = await import("./teams-notify.server");
    const { error } = await supabaseAdmin
      .from("teams_action_links")
      .update({ used_at: new Date().toISOString(), used_by: context.userId })
      .eq("token_hash", hashActionToken(data.token))
      .is("used_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Staff view: Teams delivery outcomes across all workspaces. */
export const listTeamsDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (staff !== true) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: rows }, { data: links }] = await Promise.all([
      supabaseAdmin
        .from("teams_delivery_log")
        .select("id, organization_id, event_type, status, error_code, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("teams_channel_links").select("organization_id, enabled"),
    ]);
    const failures = (rows ?? []).filter((r) => r.status !== "delivered").length;
    return {
      items: rows ?? [],
      connected: (links ?? []).length,
      active: (links ?? []).filter((l) => l.enabled).length,
      failures,
    };
  });
