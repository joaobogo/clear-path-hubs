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

/** Work-queue scope comes from the caller's saved preference, not the URL. */
const workQueueInput = (i: unknown) =>
  z.object({ include_test: z.boolean().optional() }).parse(i ?? {});

export const getAdminWorkQueues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(workQueueInput)
  .handler(async ({ data, context }) => {
    const { requireStaff, loadWorkQueues } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveShowTestRecordsForUser } = await import("./admin-test-scope.server");
    const includeTest =
      data.include_test ??
      (await resolveShowTestRecordsForUser(supabaseAdmin as never, context.userId));
    return {
      queues: await loadWorkQueues({ includeTest }),
      include_test: includeTest,
      generated_at: new Date().toISOString(),
    };
  });

/**
 * Take ownership of a queue row. Ownership lives on the governing position or
 * intake, so this delegates to the same audited writers the ownership screens
 * use — never a direct update from the overview.
 */
export const claimWorkQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ kind: z.enum(["position", "intake"]), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.kind === "position") {
      const { setPositionOwnership } = await import("./position-ownership.server");
      await setPositionOwnership(supabaseAdmin as never, {
        positionId: data.id,
        ownerUserId: context.userId,
        actorUserId: context.userId,
        reason: "Claimed from the admin work queue",
      });
    } else {
      const { assignIntakeOwnerRow } = await import("./admin-intake-aging.server");
      await assignIntakeOwnerRow(supabaseAdmin as never, {
        intakeId: data.id,
        ownerUserId: context.userId,
        actorUserId: context.userId,
      });
    }
    return { ok: true as const, owner_user_id: context.userId };
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
