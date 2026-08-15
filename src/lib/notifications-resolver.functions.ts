import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * resolveActionableNotifications
 * ----------------------------
 * Scans a user's notifications and resolves any that are now "clear" based on 
 * the underlying record state.
 */
export const resolveActionableNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // 1. Fetch unread/unresolved action_required notifications
    const { data: notifications, error } = await supabaseAdmin
      .from("notifications")
      .select("id, event_type, entity_id, entity_type, organization_id")
      .eq("recipient_user_id", userId)
      .eq("event_type", "approval_needed")
      .is("resolved_at", null);

    if (error || !notifications || notifications.length === 0) return { resolved: 0 };

    const resolvedIds: string[] = [];

    // 2. For each notification, check if the "decision" is still needed
    // In our system, 'approval_needed' usually maps to a delivered candidate 
    // or a task that needs action.
    for (const n of notifications) {
      if (!n.entity_id) continue;

      if (n.entity_type === "candidate_match") {
        // Check if the candidate still needs a decision
        const { data: match } = await supabaseAdmin
          .from("candidate_matches")
          .select("id")
          .eq("id", n.entity_id)
          .eq("client_visibility", "visible")
          .maybeSingle();
        
        if (!match) {
            resolvedIds.push(n.id);
            continue;
        }

        const { data: decision } = await supabaseAdmin
          .from("client_decisions")
          .select("id")
          .eq("candidate_match_id", n.entity_id)
          .maybeSingle();
        
        if (decision) {
          resolvedIds.push(n.id);
        }
      }
      // Add logic for other entity types if needed (tasks, etc.)
    }

    if (resolvedIds.length > 0) {
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("notifications")
        .update({ resolved_at: now, read_at: now } as any)
        .in("id", resolvedIds);
    }

    return { resolved: resolvedIds.length };
  });
