/**
 * Staff-only server functions for the /admin/notifications delivery-failure
 * section. Thin wrappers — logic lives in notification-failures.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * THE delivery-failure metric. One implementation, one 7-day window; every
 * admin surface calls this and reads `summary.retryable`.
 */
export const getDeliveryFailureMetric = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformStaff } = await import("./authz.server");
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadDeliveryHealth, loadEmailSentVolume } = await import(
      "./notification-failures.server"
    );
    const health = await loadDeliveryHealth(supabaseAdmin);
    // Only /admin/notifications renders the volume tiles, so only this call
    // path reads the provider log. Same window as the rest of the payload.
    const emailSent = await loadEmailSentVolume(health.windowDays);
    return { ...health, volume: { ...health.volume, emailSent } };
  });

/** @deprecated Use getDeliveryFailureMetric — same payload, same cache key. */
export const listDeliveryFailureQueue = getDeliveryFailureMetric;

export const retryDeliveryFailureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        ledger: z.enum(["notification", "lead", "application"]),
        id: z.string().uuid(),
        acknowledgeStale: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { assertPlatformStaff } = await import("./authz.server");
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { retryDeliveryFailure } = await import("./notification-failures.server");
    return retryDeliveryFailure(supabaseAdmin, { ledger: data.ledger, id: data.id });
  });

export const retryAllDeliveryFailuresFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { assertPlatformStaff } = await import("./authz.server");
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { retryAllDeliveryFailures } = await import("./notification-failures.server");
    return retryAllDeliveryFailures(supabaseAdmin, { limit: data.limit });
  });

export const suppressNotificationRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        email: z.string().trim().email(),
        reason: z.string().trim().min(10, "Give a reason of at least 10 characters."),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { assertPlatformStaff } = await import("./authz.server");
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { suppressRecipient } = await import("./notification-suppression.server");
    return suppressRecipient(supabaseAdmin, {
      email: data.email,
      reason: data.reason,
      actorUserId: context.userId,
    });
  });

export const releaseNotificationRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ email: z.string().trim().email() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { assertPlatformStaff } = await import("./authz.server");
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { releaseRecipient } = await import("./notification-suppression.server");
    return releaseRecipient(supabaseAdmin, { email: data.email, actorUserId: context.userId });
  });

/**
 * Lift the blocks on one address and (optionally) re-attempt the delivery that
 * exposed them. One canonical path — admin rows and the recipient banner both
 * call this.
 */
export const unsuppressAndRetryDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        email: z.string().trim().email(),
        ledger: z.enum(["notification", "lead", "application"]).optional(),
        id: z.string().uuid().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { assertPlatformStaff } = await import("./authz.server");
    await assertPlatformStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { unsuppressAndRetry } = await import("./notification-failures.server");
    return unsuppressAndRetry(supabaseAdmin, {
      email: data.email,
      actorUserId: context.userId,
      ledger: data.ledger,
      id: data.id,
    });
  });
