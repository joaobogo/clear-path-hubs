import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripChip, QueueSignal } from "@/lib/integration-strip.server";

export type { StripChip, QueueSignal };

async function assertStaff(context: { supabase: { rpc: Function }; userId: string }) {
  const { data: staff } = await context.supabase.rpc("is_platform_staff", {
    _user: context.userId,
  });
  if (staff !== true) throw new Error("Forbidden");
}

export const getIntegrationStrip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadIntegrationStrip } = await import("@/lib/integration-strip.server");
    return await loadIntegrationStrip(supabaseAdmin);
  });

export const drainIntegrationQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ queue: z.enum(["crm", "processing"]) }).parse(raw))
  .handler(async ({ context, data }) => {
    await assertStaff(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { drainIntegrationQueueByKey } = await import("@/lib/integration-strip.server");
    return await drainIntegrationQueueByKey(supabaseAdmin, data.queue, context.userId);
  });
