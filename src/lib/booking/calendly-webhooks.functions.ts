/**
 * Admin-facing Calendly webhook controls.
 *
 * Staff-only: provisioning a subscription writes our signing key into Calendly,
 * so the caller must be platform staff. The signing key itself never crosses
 * this boundary — only status facts do.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireStaff(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("is_platform_staff", { _user: context.userId });
  if (data !== true) throw new Error("Forbidden");
}

export type CalendlyWebhookStatus = {
  /** Whether the Calendly connection is linked and reachable. */
  connected: boolean;
  signingKeyConfigured: boolean;
  callbackUrl: string;
  events: string[];
  owner: { name: string } | null;
  subscriptions: {
    uri: string;
    callbackUrl: string;
    state: string;
    events: string[];
    createdAt: string;
    retryStartedAt: string | null;
    isOurs: boolean;
  }[];
  recentDeliveries: {
    id: string;
    eventType: string;
    matchedSession: boolean;
    receivedAt: string | null;
  }[];
  error: string | null;
};

export const getCalendlyWebhookStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CalendlyWebhookStatus> => {
    await requireStaff(context as never);

    const { calendlyWebhookUrl, CALENDLY_WEBHOOK_EVENTS, resolveCalendlyOwner, listWebhookSubscriptions } =
      await import("@/lib/booking/calendly-webhooks.server");

    const callbackUrl = calendlyWebhookUrl();
    const base: CalendlyWebhookStatus = {
      connected: false,
      signingKeyConfigured: Boolean(process.env["CALENDLY_WEBHOOK_SIGNING_KEY"]),
      callbackUrl,
      events: [...CALENDLY_WEBHOOK_EVENTS],
      owner: null,
      subscriptions: [],
      recentDeliveries: [],
      error: null,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: deliveries } = await supabaseAdmin
      .from("calendly_webhook_events")
      .select("id, event_type, booking_session_id, received_at")
      .order("received_at", { ascending: false })
      .limit(10);

    base.recentDeliveries = (deliveries ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      matchedSession: Boolean(row.booking_session_id),
      receivedAt: (row as { received_at?: string | null }).received_at ?? null,
    }));

    const owner = await resolveCalendlyOwner();
    if (!owner.ok) return { ...base, error: owner.detail };

    base.connected = true;
    base.owner = { name: owner.data.name };

    const subs = await listWebhookSubscriptions(owner.data);
    if (!subs.ok) return { ...base, error: subs.detail };

    base.subscriptions = subs.data.map((s) => ({
      uri: s.uri,
      callbackUrl: s.callback_url,
      state: s.state,
      events: s.events ?? [],
      createdAt: s.created_at,
      retryStartedAt: s.retry_started_at ?? null,
      isOurs: s.callback_url === callbackUrl,
    }));
    return base;
  });

export const provisionCalendlyWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context as never);
    const { resolveCalendlyOwner, ensureWebhookSubscription } = await import(
      "@/lib/booking/calendly-webhooks.server"
    );

    const owner = await resolveCalendlyOwner();
    if (!owner.ok) return { ok: false as const, error: owner.detail };

    const result = await ensureWebhookSubscription(owner.data);
    if (!result.ok) return { ok: false as const, error: result.detail };

    return {
      ok: true as const,
      callbackUrl: result.data.subscription.callback_url,
      events: result.data.subscription.events ?? [],
      replaced: result.data.replaced,
    };
  });

export const removeCalendlyWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ uri: z.string().max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context as never);
    const { deleteWebhookSubscription } = await import("@/lib/booking/calendly-webhooks.server");
    const result = await deleteWebhookSubscription(data.uri);
    return result.ok ? { ok: true as const } : { ok: false as const, error: result.detail };
  });
