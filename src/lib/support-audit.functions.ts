import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getSupportAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ days: z.number().int().min(1).max(90).default(7) }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (isStaff !== true) throw new Error("Forbidden: platform staff required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSupportAudit } = await import("@/lib/support-audit.server");
    return loadSupportAudit(supabaseAdmin, data.days);
  });

/**
 * Returns the caller's live support session for an organization, or null.
 * Read-only lookup; never creates a session.
 */
export const getActiveSupportSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ organization_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (isStaff !== true) throw new Error("Forbidden: platform staff required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { findActiveSupportSession } = await import("@/lib/support-audit.server");
    const session = await findActiveSupportSession(
      supabaseAdmin,
      context.userId,
      data.organization_id,
    );
    return { session };
  });

/**
 * Staff entering a client workspace is allowed, not gated: platform staff get
 * read-only access as soon as they open a workspace from the admin client list.
 * Access is still never silent — if no live session exists we open one here and
 * record it, so every staff visit stays attributable. A failure to record must
 * not block access; it returns a null session id and the read-only banner still
 * shows.
 */
export const ensureSupportSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        organization_id: z.string().uuid(),
        permission_preview: z
          .enum(["client_admin", "client_editor", "client_viewer"])
          .default("client_admin"),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (isStaff !== true) throw new Error("Forbidden: platform staff required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { findActiveSupportSession, recordSupportAction } = await import(
      "@/lib/support-audit.server"
    );

    const existing = await findActiveSupportSession(
      supabaseAdmin,
      context.userId,
      data.organization_id,
    );
    if (existing) return { session: existing };

    try {
      const { data: staffMem } = await supabaseAdmin
        .from("memberships")
        .select("role")
        .eq("user_id", context.userId)
        .in("role", ["platform_admin", "operations"])
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      const actorRole =
        ((staffMem as { role?: string } | null)?.role as "platform_admin" | "operations") ??
        "operations";

      const { data: targetMember } = await supabaseAdmin
        .from("memberships")
        .select("user_id")
        .eq("organization_id", data.organization_id)
        .eq("status", "active")
        .in("role", ["client_admin", "client_editor", "client_viewer"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const reason = "Staff opened this workspace from the admin client list (read-only).";
      const trace = `sv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      const { data: session, error } = await supabaseAdmin
        .from("support_sessions")
        .insert({
          actor_user_id: context.userId,
          actor_role: actorRole,
          target_user_id:
            ((targetMember as { user_id?: string } | null)?.user_id as string | undefined) ??
            context.userId,
          organization_id: data.organization_id,
          mode: "read_only",
          permission_preview: data.permission_preview,
          reason,
          scope: "read_only",
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          trace_id: trace,
        })
        .select("id, organization_id, mode, permission_preview, expires_at, reason, trace_id")
        .single();
      if (error) throw error;

      await recordSupportAction(supabaseAdmin, {
        session_id: session.id as string,
        actor_user_id: context.userId,
        organization_id: data.organization_id,
        action: "view_as_start",
        target_type: "organizations",
        target_id: data.organization_id,
        reason,
        after_state: { mode: "read_only", permission_preview: data.permission_preview },
        trace_id: trace,
      });

      return { session };
    } catch (err) {
      console.error("ensureSupportSession could not record staff entry", err);
      return { session: null };
    }
  });

