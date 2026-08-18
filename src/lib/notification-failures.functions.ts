/**
 * Staff-only server functions for the /admin/notifications delivery-failure
 * section. Thin wrappers — logic lives in notification-failures.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("is_platform_staff", { _user: context.userId });
  if (data !== true) throw new Error("Forbidden");
}

export const listDeliveryFailureQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadDeliveryFailures } = await import("./notification-failures.server");
    return loadDeliveryFailures(supabaseAdmin);
  });

export const retryDeliveryFailureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        ledger: z.enum(["notification", "lead"]),
        id: z.string().uuid(),
        acknowledgeStale: z.boolean().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { retryDeliveryFailure } = await import("./notification-failures.server");
    return retryDeliveryFailure(supabaseAdmin, { ledger: data.ledger, id: data.id });
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
    await assertStaff(context as never);
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
    await assertStaff(context as never);
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
        ledger: z.enum(["notification", "lead"]).optional(),
        id: z.string().uuid().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { unsuppressAndRetry } = await import("./notification-failures.server");
    return unsuppressAndRetry(supabaseAdmin, {
      email: data.email,
      actorUserId: context.userId,
      ledger: data.ledger,
      id: data.id,
    });
  });
