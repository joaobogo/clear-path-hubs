/**
 * Server functions for position ownership and coverage. Staff-only; every
 * mutation writes audit events. Reassignment is always explicit — no
 * auto-assignment of any kind.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const bulkInput = z.object({
  from_user_id: z.string().uuid(),
  to_user_id: z.string().uuid(),
  include_backup: z.boolean().default(true),
  include_test: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
});

export const getCoverageQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ include_test: z.boolean().optional(), all: z.boolean().optional() })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadCoverageQueue } = await import("./position-ownership.server");
    return loadCoverageQueue(supabaseAdmin as never, {
      includeTest: data.include_test ?? false,
      all: data.all ?? false,
    });
  });

export const listOwnershipStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadStaffOptions } = await import("./position-ownership.server");
    return loadStaffOptions(supabaseAdmin as never);
  });

export const setPositionOwners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        position_id: z.string().uuid(),
        owner_user_id: z.string().uuid().nullable().optional(),
        backup_owner_user_id: z.string().uuid().nullable().optional(),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setPositionOwnership } = await import("./position-ownership.server");
    return setPositionOwnership(supabaseAdmin as never, {
      positionId: data.position_id,
      ...(data.owner_user_id !== undefined ? { ownerUserId: data.owner_user_id } : {}),
      ...(data.backup_owner_user_id !== undefined
        ? { backupOwnerUserId: data.backup_owner_user_id }
        : {}),
      // Actor is server-derived from the authenticated session, never from the request payload.
      actorUserId: context.userId,
      reason: data.reason ?? null,
    });
  });

export const previewOwnerBulkReassign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => bulkInput.parse(i))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { previewBulkReassign } = await import("./position-ownership.server");
    return previewBulkReassign(supabaseAdmin as never, {
      fromUserId: data.from_user_id,
      toUserId: data.to_user_id,
      includeBackup: data.include_backup,
      includeTest: data.include_test ?? false,
    });
  });

export const applyOwnerBulkReassign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => bulkInput.parse(i))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyBulkReassign } = await import("./position-ownership.server");
    return applyBulkReassign(supabaseAdmin as never, {
      fromUserId: data.from_user_id,
      toUserId: data.to_user_id,
      includeBackup: data.include_backup,
      includeTest: data.include_test ?? false,
      // Actor is server-derived from the authenticated session, never from the request payload.
      actorUserId: context.userId,
      reason: data.reason ?? null,
    });
  });
