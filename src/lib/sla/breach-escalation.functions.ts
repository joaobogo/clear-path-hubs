/**
 * Staff-only server functions for SLA breach escalation.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const escalateBreaches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ include_test: z.boolean().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { escalateSlaBreaches } = await import("./breach-escalation.server");
    return escalateSlaBreaches(supabaseAdmin as never, {
      actorUserId: context.userId,
      includeTest: data.include_test ?? false,
    });
  });
