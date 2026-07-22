import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  EVENT_TYPES,
  type Audience,
  type EventType,
  copyFor,
  eventKey,
} from "./events";

/**
 * emitEventFromServer
 * -------------------
 * Server-only helper. Import from a *.server.ts or dynamically from a server-fn
 * handler. Idempotent by construction: (event_type, scope) -> single event row,
 * and (event, recipient) -> at most one notification per recipient.
 */
export async function emitEventFromServer(args: {
  event: EventType;
  scope: string; // stable identifier for the real-world event (e.g. application id)
  organization_id?: string | null;
  position_id?: string | null;
  application_id?: string | null;
  candidate_match_id?: string | null;
  candidate_profile_id?: string | null;
  actor_user_id?: string | null;
  payload?: Record<string, unknown>;
  // Explicit recipients. If omitted for audience 'client', fans out to org members.
  recipients?: Array<{ user_id: string; audience: Audience; link_path?: string }>;
  link_path?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const key = eventKey(args.event, args.scope);
  // Idempotent insert of the event
  const { data: existing } = await supabaseAdmin
    .from("notification_events")
    .select("id")
    .eq("idempotency_key", key)
    .maybeSingle();

  let eventId: string;
  if (existing) {
    eventId = existing.id as string;
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from("notification_events")
      .insert({
        event_type: args.event,
        idempotency_key: key,
        organization_id: args.organization_id ?? null,
        position_id: args.position_id ?? null,
        application_id: args.application_id ?? null,
        candidate_match_id: args.candidate_match_id ?? null,
        candidate_profile_id: args.candidate_profile_id ?? null,
        actor_user_id: args.actor_user_id ?? null,
        payload: (args.payload ?? {}) as never,
      })
      .select("id")
      .single();
    if (error) throw error;
    eventId = inserted.id as string;
  }

  // Resolve recipients
  let recipients = args.recipients ?? [];
  if (recipients.length === 0) {
    // Auto-fanout to org viewers (client audience) + platform staff (admin audience)
    const buckets: Array<{ user_id: string; audience: Audience; link_path?: string }> = [];

    if (args.organization_id) {
      const { data: members } = await supabaseAdmin
        .from("memberships")
        .select("user_id, role")
        .eq("organization_id", args.organization_id)
        .eq("status", "active");
      for (const m of members ?? []) {
        const role = m.role as string;
        if (role.startsWith("client_")) {
          buckets.push({ user_id: m.user_id as string, audience: "client", link_path: args.link_path });
        } else if (role === "platform_admin" || role === "operations") {
          buckets.push({ user_id: m.user_id as string, audience: "admin", link_path: args.link_path });
        }
      }
    }
    recipients = buckets;
  }

  if (recipients.length === 0) return { event_id: eventId, delivered: 0 };

  // Build rows with audience-safe copy
  const rows = recipients
    .map((r) => {
      const copy = copyFor(r.audience, args.event);
      if (!copy) return null;
      return {
        event_id: eventId,
        recipient_user_id: r.user_id,
        audience: r.audience,
        organization_id: args.organization_id ?? null,
        event_type: args.event,
        title: copy.title,
        body: copy.body ?? null,
        link_path: r.link_path ?? args.link_path ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (rows.length === 0) return { event_id: eventId, delivered: 0 };

  // Upsert prevents duplicates per (event_id, recipient_user_id)
  const { data: notifs, error: nerr } = await supabaseAdmin
    .from("notifications")
    .upsert(rows, { onConflict: "event_id,recipient_user_id", ignoreDuplicates: true })
    .select("id");
  if (nerr) throw nerr;

  // Record in_app delivery as delivered for each new notification
  if (notifs && notifs.length > 0) {
    const deliveries = notifs.map((n) => ({
      notification_id: n.id as string,
      channel: "in_app" as const,
      status: "delivered" as const,
    }));
    await supabaseAdmin
      .from("notification_deliveries")
      .upsert(deliveries, { onConflict: "notification_id,channel", ignoreDuplicates: true });
  }

  return { event_id: eventId, delivered: notifs?.length ?? 0 };
}

// ---------- Client-callable server functions ----------

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, event_type, audience, title, body, link_path, read_at, created_at, organization_id")
      .eq("recipient_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const unread = (data ?? []).filter((n) => !n.read_at).length;
    return { items: data ?? [], unread };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ ids: z.array(z.string().uuid()).optional() }).parse(raw))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_user_id", context.userId)
      .is("read_at", null);
    if (data.ids && data.ids.length > 0) q = q.in("id", data.ids);
    const { error } = await q;
    if (error) throw error;
    return { ok: true };
  });

export const listDeliveryFailures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff", { _user: context.userId });
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("notification_deliveries")
      .select("id, channel, status, error_code, error_message, updated_at, notification_id, notifications:notification_id(title, audience, recipient_user_id, event_type)")
      .in("status", ["failed", "bounced", "suppressed"])
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { items: data ?? [] };
  });

export const listEventCatalogue = createServerFn({ method: "GET" }).handler(async () => {
  return { events: EVENT_TYPES };
});
