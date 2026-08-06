/**
 * Staff server functions for the terminal-outcome queue.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listOutcomeBreaches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ include_test: z.boolean().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("../admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadOutcomeBreaches } = await import("./outcome-sla.server");
    return loadOutcomeBreaches(supabaseAdmin as never, {
      includeTest: data.include_test ?? false,
    });
  });

/**
 * Sends the outstanding outcome notices immediately, rather than waiting for the
 * scheduled sweep. Idempotent: each application is only ever told once.
 */
export const sendPendingOutcomeNotices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireStaff } = await import("../admin-ops.server");
    await requireStaff(context.userId);
    const { runClosureNotices } = await import("./closure-notices.server");
    return runClosureNotices();
  });
