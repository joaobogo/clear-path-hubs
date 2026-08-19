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
    const seen = new Set<string>();
    // Nobody is told about their own action: a self-notification is noise and
    // it inflated the unread badge of whoever just clicked the button.
    const actorId = args.actor_user_id ?? null;
    // A message never notifies the side that wrote it — staff writing into a
    // client thread must not raise "New client message" for the staff bell,
    // and a client teammate must not raise "New message from TaaSFlow".
    let suppressed: Audience | null = null;
    if (args.event === "message_sent" && actorId) {
      const { data: actorRoles } = await supabaseAdmin
        .from("memberships")
        .select("role")
        .eq("user_id", actorId)
        .eq("status", "active");
      const roles = (actorRoles ?? []).map((r) => r.role as string);
      if (roles.some((r) => r === "platform_admin" || r === "operations")) suppressed = "admin";
      else if (roles.some((r) => r.startsWith("client_"))) suppressed = "client";
      else suppressed = "candidate";
    }
    const push = (user_id: string, audience: Audience) => {
      if (actorId && user_id === actorId) return;
      if (suppressed && audience === suppressed) return;
      const k = `${user_id}:${audience}`;
      if (seen.has(k)) return;
      seen.add(k);
      buckets.push({ user_id, audience, link_path: args.link_path });
    };

    if (args.organization_id) {
      const { data: members } = await supabaseAdmin
        .from("memberships")
        .select("user_id, role")
        .eq("organization_id", args.organization_id)
        .eq("status", "active");
      for (const m of members ?? []) {
        const role = m.role as string;
        if (role.startsWith("client_")) {
          push(m.user_id as string, "client");
        } else if (role === "platform_admin" || role === "operations") {
          push(m.user_id as string, "admin");
        }
      }
    }

    // Platform staff are not members of the client workspace, so an org-only
    // fanout left admin-audience events (a new application, for one) with zero
    // notifications and nothing in the staff bell. Staff seats are global —
    // matching public.is_platform_staff — so they are resolved separately.
    // Only events that actually have admin copy reach them.
    if (copyFor("admin", args.event)) {
      const { data: staff } = await supabaseAdmin
        .from("memberships")
        .select("user_id")
        .eq("status", "active")
        .in("role", ["platform_admin", "operations"]);
      for (const s of staff ?? []) push(s.user_id as string, "admin");
    }
    recipients = buckets;
  }
  // An explicit recipient list must obey the same rule as the fanout: never
  // notify the person who performed the action.
  if (args.actor_user_id) {
    recipients = recipients.filter((r) => r.user_id !== args.actor_user_id);
  }

  if (recipients.length === 0) return { event_id: eventId, delivered: 0 };

  // Actor enrichment and identity for the bell.
  let actorName: string | null = null;
  if (args.actor_user_id) {
    const { resolveStaffPersona } = await import("./staff-persona.server");
    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("auth_user_id", args.actor_user_id)
      .maybeSingle();

    const { data: actorMembership } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("user_id", args.actor_user_id)
      .eq("status", "active")
      .maybeSingle();

    const isStaff = actorMembership ? ["platform_admin", "operations"].includes(actorMembership.role) : false;
    const persona = resolveStaffPersona({
      name: (actorProfile?.full_name as string | null) ?? null,
      email: (actorProfile?.email as string | null) ?? null,
      isStaff,
    });
    
    if (persona.name) {
      actorName = persona.name;
    }
  }

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
        title: args.event === "approval_needed" && actorName 
          ? `${actorName}: ${copy.title}` 
          : actorName && args.event === "message_sent" 
            ? `New message from ${actorName}` 
            : actorName && r.audience === "client" && args.event === "candidate_stage_changed"
              ? `Status changed by ${actorName}`
              : copy.title,
        body: copy.body ?? null,
        link_path: r.link_path ?? args.link_path ?? (args.candidate_match_id ? `/admin/review/${args.candidate_match_id}` : null),
        // Point every notification at the exact record it is about.
        entity_type: args.candidate_match_id
          ? "candidate_match"
          : args.application_id
            ? "application"
            : args.position_id
              ? "position"
              : args.organization_id
                ? "organization"
                : null,
        entity_id:
          args.candidate_match_id ??
          args.application_id ??
          args.position_id ??
          args.organization_id ??
          null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (rows.length === 0) return { event_id: eventId, delivered: 0 };

  // Upsert prevents duplicates per (event_id, recipient_user_id)
  const { data: notifs, error: nerr } = await supabaseAdmin
    .from("notifications")
    .upsert(rows, { onConflict: "event_id,recipient_user_id", ignoreDuplicates: true })
    .select("id, recipient_user_id, organization_id, event_type, title, body, link_path, audience");
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

    // Email channel: at most one per notification, preference-aware, logged.
    try {
      const { dispatchEmails } = await import("./notification-email.server");
      await dispatchEmails(
        supabaseAdmin,
        notifs.map((n) => ({
          id: n.id as string,
          recipient_user_id: n.recipient_user_id as string,
          organization_id: (n.organization_id as string | null) ?? null,
          event_type: n.event_type as EventType,
          title: n.title as string,
          body: (n.body as string | null) ?? null,
          link_path: (n.link_path as string | null) ?? null,
          audience: (n.audience as string | null) ?? null,
        })),
      );
    } catch (e) {
      console.error("[emitEventFromServer] email dispatch failed", e);
    }

    // Teams channel: one post per workspace, only when that workspace has
    // connected a channel and selected this event. A shared channel is an
    // audience whose individual permissions we cannot verify, so anything
    // carrying candidate-specific detail is withheld from it.
    const { isSafeForUncertainAudience } = await import("./notifications/notification-tiers");
    if (
      args.organization_id &&
      notifs.some((n) => n.organization_id) &&
      isSafeForUncertainAudience(args.event)
    ) {
      try {
        const { notifyOrgTeamsSafe } = await import("./teams-notify.server");
        const first = notifs[0];
        notifyOrgTeamsSafe({
          organizationId: args.organization_id,
          eventType: args.event,
          notice: {
            title: (first.title as string) ?? "TaaSFlow update",
            subtitle: (first.body as string | null) ?? undefined,
            linkPath: (first.link_path as string | null) ?? "/client",
            linkLabel: "Open in TaaSFlow",
          },
          candidateMatchId: args.candidate_match_id ?? null,
          actions: args.candidate_match_id
            ? ["shortlist", "hold", "not_moving_forward"]
            : undefined,
        });
      } catch (e) {
        console.error("[emitEventFromServer] teams dispatch failed", e);
      }
    }
  }

  return { event_id: eventId, delivered: notifs?.length ?? 0 };
}



// ---------- Client-callable server functions ----------

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Reconcile actionable notifications before listing.
    // We check for 'approval_needed' notifications whose entity (candidate_match) 
    // already has a client decision recorded.
    const { data: openActionables } = await context.supabase
      .from("notifications")
      .select("id, entity_id, entity_type")
      .eq("recipient_user_id", context.userId)
      .eq("event_type", "approval_needed")
      .is("resolved_at", null);

    if (openActionables && openActionables.length > 0) {
      const matchIds = openActionables
        .filter(n => n.entity_type === "candidate_match" && n.entity_id)
        .map(n => n.entity_id as string);
      
      if (matchIds.length > 0) {
        const { data: decidedMatches } = await context.supabase
          .from("client_decisions")
          .select("candidate_match_id")
          .in("candidate_match_id", matchIds);
        
        const decidedSet = new Set((decidedMatches ?? []).map(d => d.candidate_match_id as string).filter(Boolean));
        const toResolve = openActionables
          .filter(n => n.entity_type === "candidate_match" && n.entity_id && decidedSet.has(n.entity_id))
          .map(n => n.id);
        
        if (toResolve.length > 0) {
          const now = new Date().toISOString();
          await supabaseAdmin
            .from("notifications")
            .update({ resolved_at: now, read_at: now } as any)
            .in("id", toResolve);
        }
      }
    }

    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, event_type, audience:audience::text, title, body, link_path, read_at, resolved_at, entity_type, entity_id, created_at, organization_id, event_id")
      .eq("recipient_user_id", context.userId)
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    const rows = data ?? [];

    // Actor enrichment. Read through the caller's own client so RLS decides
    // what they may see; when an event row is not readable we simply fall back
    // to a system label rather than leaking anything.
    const eventIds = [...new Set(rows.map((r: any) => r.event_id).filter((v: any): v is string => !!v))];
    const actorByEvent = new Map<string, string | null>();
    if (eventIds.length > 0) {
      const { data: events } = await context.supabase
        .from("notification_events")
        .select("id, actor_user_id")
        .in("id", eventIds);
      const actorIds = [
        ...new Set(
          (events ?? [])
            .map((e: any) => e.actor_user_id as string | null)
            .filter((v: any): v is string => !!v),
        ),
      ];
      const nameById = new Map<string, string | null>();
      if (actorIds.length > 0) {
        const { data: profiles } = await context.supabase
          .from("profiles")
          .select("auth_user_id, full_name, email")
          .in("auth_user_id", actorIds);

        const { data: memberships } = await context.supabase
          .from("memberships")
          .select("user_id, role")
          .in("user_id", actorIds)
          .eq("status", "active");

        const { resolveStaffPersona } = await import("./staff-persona.server");
        const staffRoles = new Set(["platform_admin", "operations"]);

        for (const p of profiles ?? []) {
          const m = (memberships ?? []).find(mem => mem.user_id === p.auth_user_id);
          const isStaff = m ? staffRoles.has(m.role) : false;
          const persona = resolveStaffPersona({
            name: (p.full_name as string | null) ?? null,
            email: (p.email as string | null) ?? null,
            isStaff,
          });
          nameById.set(p.auth_user_id as string, persona.name);
        }
      }
      for (const e of events ?? []) {
        const actorId = e.actor_user_id as string | null;
        actorByEvent.set(
          e.id as string,
          actorId
            ? actorId === context.userId
              ? "You"
              : (nameById.get(actorId) || ((rows[0]?.audience as any) === "client" ? "TaaSFlow team" : "Staff"))
            : ((rows[0]?.audience as any) === "client" ? "TaaSFlow team" : "Staff"),
        );
      }
    }

    // Delivery state for the email copy of each notification. The deliveries
    // ledger is staff-readable only, so this reads through the admin client but
    // is hard-scoped to notification ids we already proved belong to the caller.
    const deliveryByNotification = new Map<string, string>();
    if (rows.length > 0) {
      const { normaliseDeliveryStatus } = await import("./notifications/delivery-state");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: deliveries } = await supabaseAdmin
        .from("notification_deliveries")
        .select("notification_id, status, last_attempt_at, created_at")
        .in(
          "notification_id",
          rows.map((r: any) => r.id),
        )
        // Only the email channel is user-visible here; the in_app row is always
        // "delivered" and used to mask a real email failure (and vice versa).
        .eq("channel", "email")
        .order("created_at", { ascending: true });
      for (const d of deliveries ?? []) {
        const state = normaliseDeliveryStatus(d.status as string | null);
        if (!state) continue;
        const id = d.notification_id as string | null;
        if (!id) continue;
        // Later attempts win, so a successful resend clears an earlier failure.
        deliveryByNotification.set(id, state);
      }
    }

    const items = rows.map((r: any) => ({
      ...r,
      actor_label: r.event_id ? (actorByEvent.get(r.event_id) ?? null) : null,
      delivery_state: deliveryByNotification.get(r.id) ?? null,
    }));
    const unread = items.filter((n: any) => !n.read_at).length;
    return { items, unread };
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

/**
 * Dismissal is tier-aware and enforced on the server: critical notifications
 * describe a live problem, so they stay in the inbox until the underlying
 * situation is fixed. Everything else can be cleared by its recipient.
 */
export const dismissNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { tierFor } = await import("./notifications/notification-tiers");
    const { data: rows, error: readErr } = await context.supabase
      .from("notifications")
      .select("id, event_type")
      .eq("recipient_user_id", context.userId)
      .in("id", data.ids);
    if (readErr) throw readErr;

    const dismissable = (rows ?? [])
      .filter((r) => tierFor(r.event_type as string) !== "critical")
      .map((r) => r.id as string);
    const blocked = (rows ?? []).length - dismissable.length;
    if (dismissable.length === 0) return { ok: true, dismissed: 0, blocked };

    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("notifications")
      .update({ resolved_at: now, read_at: now } as never)
      .eq("recipient_user_id", context.userId)
      .in("id", dismissable);
    if (error) throw error;
    return { ok: true, dismissed: dismissable.length, blocked };
  });

export const listDeliveryFailures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  // The delivery-health page reads the default window and passes no argument,
  // so an absent payload is valid input — not a validation failure.
  .inputValidator((raw) =>
    z.object({ window_days: z.number().optional().default(7) }).parse(raw ?? {}),
  )
  .handler(async ({ data: inputData, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff", { _user: context.userId });
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadDeliveryFailures } = await import("./notification-failures.server");
    const { readEmailConfig } = await import("./notification-email.server");

    // Operations page, exception digest, and notifications panel must all read
    // the same 7-day windowed ledger so "Delivery failures (7d)" always matches.
    try {
      const failures = await loadDeliveryFailures(supabaseAdmin as never);

      const counts: Record<string, number> = {};
      for (const item of failures.items) {
        const k = `${item.channel}:${item.ledger}:${item.reason}`;
        counts[k] = (counts[k] ?? 0) + 1;
      }

      // Sent / delivered volume is not derivable from the failure ledger, so
      // read it from the delivery table directly. Without this the "sent"
      // tile always showed zero next to a non-zero failure count.
      const since = new Date(
        Date.now() - failures.windowDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      const volume = { emailSent: 0, inAppDelivered: 0 };
      const { data: sentRows } = await supabaseAdmin
        .from("notification_deliveries")
        .select("channel, status")
        .gte("created_at", since)
        .in("status", ["provider_accepted", "delivered"]);
      for (const row of (sentRows ?? []) as Array<{ channel: string; status: string }>) {
        if (row.channel === "email") volume.emailSent += 1;
        else if (row.channel === "in_app") volume.inAppDelivered += 1;
      }

      const cfg = readEmailConfig();
      return {
        items: failures.items,
        counts,
        // The banner and the tiles must agree on how many failures come from
        // blocked addresses, so both read this one summary.
        summary: failures.summary,
        volume,
        window_days: failures.windowDays,
        // Never expose keys — only whether a provider is usable and why not.
        email: { configured: cfg.configured, reason: cfg.reason },
      };

    } catch (e) {
      console.error("[listDeliveryFailures] load failed", e);
      const cfg = readEmailConfig();
      return {
        items: [],
        counts: {},
        summary: null,
        volume: { emailSent: 0, inAppDelivered: 0 },
        window_days: 7,
        email: { configured: cfg.configured, reason: cfg.reason },
      };

    }
  });


export const retryFailedDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ deliveryId: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff", { _user: context.userId });
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { retryDelivery } = await import("./notification-email.server");
    const result = await retryDelivery(supabaseAdmin, data.deliveryId);
    return { ok: true, result };
  });


export const listEventCatalogue = createServerFn({ method: "GET" }).handler(async () => {
  return { events: EVENT_TYPES };
});

export type { DeliveryFailure } from "./notification-failures.server";

