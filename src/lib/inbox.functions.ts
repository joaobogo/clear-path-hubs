import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Unified client inbox — Messages / Notifications / Activity.
 *
 * Reuses existing tables:
 *   messages, notifications, notification_events, audit_events,
 *   client_notification_preferences.
 *
 * All reads run through the authenticated Supabase client so RLS scopes
 * results to organizations the caller is an active member of.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// -------- Activity stream --------

export const listMyActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        organization_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Resolve org scope
    const { data: mems } = await supabase
      .from("memberships")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("status", "active");
    const orgIds = ((mems as Row[]) ?? [])
      .map((m) => m.organization_id as string)
      .filter(Boolean);
    if (orgIds.length === 0) return { items: [] };

    const scope = data.organization_id && orgIds.includes(data.organization_id)
      ? [data.organization_id]
      : orgIds;

    const { data: events, error } = await supabase
      .from("audit_events")
      .select("id, entity_type, entity_id, action, organization_id, actor_user_id, created_at, before_state, after_state")
      .in("organization_id", scope)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw error;
    return { items: (events as Row[]) ?? [] };
  });

// -------- Notification preferences --------

const prefsSchema = z.object({
  organization_id: z.string().uuid(),
});

export const getMyPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => prefsSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("client_notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (existing) return { preferences: existing };
    // Return effective defaults without writing until the user toggles something
    return {
      preferences: {
        user_id: userId,
        organization_id: data.organization_id,
        candidate_delivered: true,
        interview_request: true,
        new_message: true,
        offer_update: true,
        hire_update: true,
        email_enabled: true,
        digest: "immediate" as const,
      },
    };
  });

const updatePrefsSchema = z.object({
  organization_id: z.string().uuid(),
  candidate_delivered: z.boolean().optional(),
  interview_request: z.boolean().optional(),
  new_message: z.boolean().optional(),
  offer_update: z.boolean().optional(),
  hire_update: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  digest: z.enum(["immediate", "daily", "weekly", "off"]).optional(),
});

export const updateMyPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => updatePrefsSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { organization_id, ...patch } = data;
    // Upsert
    const { data: row, error } = await supabase
      .from("client_notification_preferences")
      .upsert(
        {
          user_id: userId,
          organization_id,
          candidate_delivered: patch.candidate_delivered ?? true,
          interview_request: patch.interview_request ?? true,
          new_message: patch.new_message ?? true,
          offer_update: patch.offer_update ?? true,
          hire_update: patch.hire_update ?? true,
          email_enabled: patch.email_enabled ?? true,
          digest: patch.digest ?? "immediate",
        },
        { onConflict: "user_id,organization_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return { preferences: row };
  });
