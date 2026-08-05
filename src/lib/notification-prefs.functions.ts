/**
 * Server functions for per-event client notification preferences.
 *
 * Saves are one event at a time so the UI can confirm (or revert) each row on
 * its own, and the handler re-validates the mode against the event's allowed
 * modes — a service notice can never be switched off through the API either.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PREFERENCE_KEYS,
  defaultPreferences,
  isModeAllowed,
  normalizePreferences,
  specFor,
  type DeliveryMode,
  type PreferenceKey,
  type PreferenceRow,
} from "./client-notification-prefs";

const keyZ = z.enum(PREFERENCE_KEYS as unknown as [PreferenceKey, ...PreferenceKey[]]);
const modeZ = z.enum(["immediate", "daily", "off"]);

async function assertMember(
  supabase: {
    from: (t: string) => any;
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  },
  userId: string,
  orgId: string,
): Promise<void> {
  const { data: member } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (member) return;
  const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (staff !== true) throw new Error("Forbidden");
}

export const getClientNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ preferences: PreferenceRow; usingDefaults: boolean }> => {
    await assertMember(context.supabase as never, context.userId, data.orgId);
    const { data: row, error } = await context.supabase
      .from("client_notification_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      preferences: row ? normalizePreferences(row as Record<string, unknown>) : defaultPreferences(),
      usingDefaults: !row,
    };
  });

export const updateClientNotificationPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; key: PreferenceKey; mode: DeliveryMode }) =>
    z.object({ orgId: z.string().uuid(), key: keyZ, mode: modeZ }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; key: PreferenceKey; mode: DeliveryMode }> => {
    await assertMember(context.supabase as never, context.userId, data.orgId);

    const spec = specFor(data.key);
    if (!isModeAllowed(data.key, data.mode)) {
      throw new Error(
        spec.lockedReason
          ? `${spec.label} can be moved to the daily digest but not switched off.`
          : `${spec.label} does not support that delivery option.`,
      );
    }

    const { data: existing } = await context.supabase
      .from("client_notification_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .eq("organization_id", data.orgId)
      .maybeSingle();

    const current = normalizePreferences(existing as Record<string, unknown> | null);
    const next = { ...current, [data.key]: data.mode };

    const { error } = await context.supabase.from("client_notification_preferences").upsert(
      {
        user_id: context.userId,
        organization_id: data.orgId,
        ...next,
      },
      { onConflict: "user_id,organization_id" },
    );
    if (error) throw new Error(error.message);

    try {
      await context.supabase.from("audit_events").insert({
        actor_user_id: context.userId,
        action: "client.settings.notification_preference.update",
        entity_type: "client_notification_preferences",
        entity_id: `${context.userId}:${data.orgId}`,
        organization_id: data.orgId,
        before_state: { [data.key]: current[data.key] } as never,
        after_state: { [data.key]: data.mode } as never,
        trace_id: `cnp-${crypto.randomUUID()}`,
      });
    } catch {
      // Audit is best-effort; the preference itself is already saved.
    }

    return { ok: true, key: data.key, mode: data.mode };
  });
