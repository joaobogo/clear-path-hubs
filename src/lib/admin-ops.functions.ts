// Thin server-function wrappers for the admin operations surfaces.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminWorkQueues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireStaff, loadWorkQueues } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    return { queues: await loadWorkQueues(), generated_at: new Date().toISOString() };
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
