// Thin server-function wrappers for the client update readiness panel.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { UpdateReadiness } from "./client-update-readiness";

export const getUpdateReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<UpdateReadiness> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadUpdateReadiness } = await import("./client-update-readiness.server");
    return loadUpdateReadiness(supabaseAdmin as never, data.organization_id);
  });

export const markClientUpdateSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        previous_baseline_at: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { markUpdateSent } = await import("./client-update-readiness.server");
    return markUpdateSent(
      supabaseAdmin as never,
      data.organization_id,
      context.userId,
      data.previous_baseline_at ?? null,
    );
  });

export const revertClientUpdateSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ organization_id: z.string().uuid(), event_id: z.string().uuid() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { revertUpdateSent } = await import("./client-update-readiness.server");
    await revertUpdateSent(
      supabaseAdmin as never,
      data.organization_id,
      context.userId,
      data.event_id,
    );
    return { ok: true as const };
  });
