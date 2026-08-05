/**
 * Support-session lifecycle. Read-only support view is implicit whenever a
 * staff member navigates /client?org=<uuid>; this fn records an audit trail
 * for that entry so support activity is not silent. Interactive support mode
 * (spec §6) is opt-in and re-uses the same table with mode='interactive'.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const startInput = z.object({
  organization_id: z.string().uuid(),
  mode: z.enum(["read_only", "interactive"]).default("read_only"),
  reason: z.string().trim().min(10, "A reason of at least 10 characters is required").max(500),
  permission_preview: z
    .enum(["client_admin", "client_editor", "client_viewer"])
    .default("client_admin"),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertPlatformStaff(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("Forbidden: platform staff required");
}

export const startSupportSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => startInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up actor role for tg_support_session_guard. memberships.user_id
    // references auth.users.id — query by the auth uid directly.
    const { data: staffMem } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["platform_admin", "operations"])
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    const actorRole = (staffMem?.role as "platform_admin" | "operations" | null) ?? "operations";

    // Interactive mode requires platform_admin.
    if (data.mode === "interactive" && actorRole !== "platform_admin") {
      throw new Error(
        "Interactive support mode requires platform_admin. Operations users are read-only.",
      );
    }

    // Look up organization name for the audit trail.
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (!org) throw new Error("Organization not found");

    // tg_support_session_guard reads memberships by target_user_id; that column
    // therefore stores an auth.users.id. Pick any active client member of the
    // target org, and fall back to the actor's own auth uid if none exist yet.
    const { data: targetMember } = await supabaseAdmin
      .from("memberships")
      .select("user_id")
      .eq("organization_id", data.organization_id)
      .eq("status", "active")
      .in("role", ["client_admin", "client_editor", "client_viewer"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const targetAuthUserId = (targetMember?.user_id as string | null) ?? context.userId;

    // Support access must always be attributable to an auditable target user.
    // If the workspace has no distinct client member yet, there is nothing to
    // support and no auditable subject — refuse rather than access silently.
    if (targetAuthUserId === context.userId) {
      throw new Error(
        "This workspace has no client user to support yet, so an auditable support session cannot be opened.",
      );
    }

    // DB constraint: expires_at <= started_at + 30 minutes.
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const trace = `sv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    // DB constraint: length(reason) >= 10.
    const reason = data.reason.trim();

    const { data: session, error } = await supabaseAdmin
      .from("support_sessions")
      .insert({
        actor_user_id: context.userId,
        actor_role: actorRole,
        target_user_id: targetAuthUserId,
        organization_id: data.organization_id,
        mode: data.mode,
        permission_preview: data.permission_preview,
        reason,
        // DB constraint: scope IN ('read_only','elevated').
        scope: data.mode === "interactive" ? "elevated" : "read_only",
        expires_at: expiresAt,
        trace_id: trace,
      })
      .select("id")
      .single();
    if (error) throw error;

    const { recordSupportAction } = await import("@/lib/support-audit.server");
    await recordSupportAction(supabaseAdmin, {
      session_id: session.id as string,
      actor_user_id: context.userId,
      organization_id: data.organization_id,
      action: "view_as_start",
      target_type: "organizations",
      target_id: data.organization_id,
      reason,
      after_state: { mode: data.mode, permission_preview: data.permission_preview },
      trace_id: trace,
    });

    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      organization_id: data.organization_id,
      entity_type: "support_sessions",
      entity_id: session.id,
      action: "support.session_started",
      after_state: {
        mode: data.mode,
        reason,
        permission_preview: data.permission_preview,
        organization_name: org.name,
      },
    });

    return {
      session_id: session.id as string,
      organization_id: data.organization_id,
      organization_name: org.name as string,
      mode: data.mode,
      expires_at: expiresAt,
    };
  });

export const endSupportSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ session_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("support_sessions")
      .update({ ended_at: new Date().toISOString(), end_reason: "user_exit" })
      .eq("id", data.session_id)
      .eq("actor_user_id", context.userId)
      .is("ended_at", null)
      .select("id, organization_id, reason, trace_id")
      .maybeSingle();
    if (error) throw error;
    if (updated) {
      const { recordSupportAction } = await import("@/lib/support-audit.server");
      await recordSupportAction(supabaseAdmin, {
        session_id: updated.id as string,
        actor_user_id: context.userId,
        organization_id: (updated.organization_id as string | null) ?? null,
        action: "view_as_end",
        target_type: "support_sessions",
        target_id: updated.id as string,
        reason: updated.reason as string,
        trace_id: (updated.trace_id as string | null) ?? null,
      });
    }
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      entity_type: "support_sessions",
      entity_id: data.session_id,
      action: "support.session_ended",
    });
    return { ok: true };
  });
