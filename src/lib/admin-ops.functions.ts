// Thin server-function wrappers for the admin operations surfaces.
//
// `include_test` is opt-in per request: admin attention surfaces hide records
// belonging to test/internal organizations unless the operator turns the
// "Show test records" toggle on.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const scopeInput = (i: unknown) =>
  z.object({ include_test: z.boolean().optional().default(false) }).parse(i ?? {});

export const getAdminWorkQueues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(scopeInput)
  .handler(async ({ data, context }) => {
    const { requireStaff, loadWorkQueues } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    return {
      queues: await loadWorkQueues({ includeTest: data.include_test }),
      include_test: data.include_test,
      generated_at: new Date().toISOString(),
    };
  });

export const getAgingIntakes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(scopeInput)
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAgingIntakes } = await import("./admin-test-scope.server");
    return loadAgingIntakes(supabaseAdmin as never, {
      includeTest: data.include_test,
      olderThanDays: 3,
      limit: 25,
    });
  });

export const getPaymentsOps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireStaff, loadPaymentsOpsPanel } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    return loadPaymentsOpsPanel();
  });

export const getReviewQueueIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireStaff, loadReviewQueueIds } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    return { ids: await loadReviewQueueIds() };
  });
