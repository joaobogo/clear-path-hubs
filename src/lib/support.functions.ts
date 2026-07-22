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
  reason: z.string().max(500).optional().nullable(),
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

    // Reason is required for interactive mode.
    if (data.mode === "interactive" && !data.reason?.trim()) {
      throw new Error("A reason is required to enable interactive support mode.");
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

    // DB constraint: actor_user_id <> target_user_id. If no distinct client
    // member exists to impersonate, skip logging (nothing to audit).
    if (targetAuthUserId === context.userId) {
      return {
        session_id: null as string | null,
        organization_id: data.organization_id,
        organization_name: org.name as string,
        mode: data.mode,
        expires_at: null as string | null,
      };
    }

    // DB constraint: expires_at <= started_at + 30 minutes.
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const trace = `sv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    // DB constraint: length(reason) >= 10.
    const rawReason = data.reason?.trim() || "";
    const reason = rawReason.length >= 10 ? rawReason : "Support view session (read-only)";

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

    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      organization_id: data.organization_id,
      entity_type: "support_sessions",
      entity_id: session.id,
      action: "support.session_started",
      after_state: {
        mode: data.mode,
        reason: data.reason ?? null,
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
    const { error } = await supabaseAdmin
      .from("support_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", data.session_id)
      .eq("actor_user_id", context.userId);
    if (error) throw error;
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      entity_type: "support_sessions",
      entity_id: data.session_id,
      action: "support.session_ended",
    });
    return { ok: true };
  });
