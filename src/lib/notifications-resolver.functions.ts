import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveNotificationsForUser } from "./notifications-resolver.server";

/**
 * resolveActionableNotifications
 * ----------------------------
 * Scans a user's notifications and resolves any that are now "clear" based on
 * the underlying record state. This endpoint is kept for explicit polling or
 * background hooks; the same logic is also invoked inline after the action that
 * completes the work (e.g. confirming an interview or reviewing a candidate).
 */
export const resolveActionableNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return resolveNotificationsForUser(supabaseAdmin, context.userId);
  });
