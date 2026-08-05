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
 * Used by the client workspace to refuse staff access that has no session (and
 * therefore no recorded reason) behind it. Never creates a session.
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
