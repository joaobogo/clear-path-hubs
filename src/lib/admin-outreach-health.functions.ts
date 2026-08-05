// Thin server-function wrappers for the outreach health monitor.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { OutreachHealthPayload } from "./admin-outreach-health.server";

export const getOutreachHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ include_test: z.boolean().optional().default(false) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<OutreachHealthPayload> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadOutreachHealth } = await import("./admin-outreach-health.server");
    return loadOutreachHealth(supabaseAdmin as never, { includeTest: data.include_test });
  });

export const setOutreachChannelEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        channel: z.enum(["email", "linkedin", "phone", "sms", "referral", "event", "other"]),
        enabled: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setChannelEnabled } = await import("./admin-outreach-health.server");
    return setChannelEnabled(supabaseAdmin as never, { ...data, actor_user_id: context.userId });
  });
