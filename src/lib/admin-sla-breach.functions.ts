/**
 * Server functions for the SLA breach panel. Staff-only; acknowledgement
 * writes an attributable audit event.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const metric = z.enum(["first_shortlist", "shortlist_size", "interview_slots"]);

export const getSlaBreaches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ include_test: z.boolean().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (process.env["ADMIN_SLA_SIMULATE_ERROR"] === "1") {
      throw new Error("Simulated SLA widget failure for error-boundary test");
    }
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSlaBreaches } = await import("./admin-sla-breach.server");
    return loadSlaBreaches(supabaseAdmin as never, { includeTest: data.include_test ?? false });
  });

export const acknowledgeBreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        commitmentId: z.string().uuid(),
        metric,
        note: z.string().trim().min(5, "Add a short note explaining the breach"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { acknowledgeSlaBreach } = await import("./admin-sla-breach.server");
    return acknowledgeSlaBreach(supabaseAdmin as never, {
      commitmentId: data.commitmentId,
      metric: data.metric,
      note: data.note,
      // Actor is server-derived from the authenticated session, never from the request payload.
      actorUserId: context.userId,
    });
  });
