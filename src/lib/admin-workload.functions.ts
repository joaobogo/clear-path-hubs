/**
 * Server functions for the recruiter workload view. Staff-only reads; the
 * reassignment action reuses `reassignPositionOwner`, which writes the audit
 * event.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getRecruiterWorkload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ include_test: z.boolean().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadWorkloadTable } = await import("./admin-workload.server");
    return loadWorkloadTable(supabaseAdmin as never, { includeTest: data.include_test ?? false });
  });

export const listOwnedOpenPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ owner: z.string().min(1), include_test: z.boolean().optional() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadOwnedPositions } = await import("./admin-workload.server");
    return loadOwnedPositions(supabaseAdmin as never, data.owner, {
      includeTest: data.include_test ?? false,
    });
  });
