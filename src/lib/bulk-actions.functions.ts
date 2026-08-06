// Thin wrappers for two-step bulk actions: preview, then execute the same plan.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BULK_STAGES } from "./admin-bulk-constants";
import type { BulkPreview, ExecResult } from "./bulk-actions.types";
import { BULK_EXEC_BATCH, BULK_SELECTION_CAP } from "./bulk-actions.types";

// Explicit ceiling on one selection: over this the request is refused with a
// message, never silently truncated to the first N rows.
const idList = z.array(z.string().uuid()).min(1).max(BULK_SELECTION_CAP);

const paramsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("candidate_stage"),
    match_ids: idList,
    to_stage: z.enum(BULK_STAGES),
  }),
  z.object({
    kind: z.literal("candidate_assign"),
    candidate_profile_ids: idList,
    position_id: z.string().uuid(),
  }),
  z.object({
    kind: z.literal("candidate_update_message"),
    match_ids: idList,
    message: z.string().trim().min(5).max(2000),
  }),
  z.object({ kind: z.literal("position_pause"), position_ids: idList }),
]);

export const previewBulkAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => paramsSchema.parse(raw))
  .handler(async ({ data, context }): Promise<BulkPreview> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPreview } = await import("./bulk-actions.server");
    return createPreview(supabaseAdmin, context.userId, data as never);
  });

export const executeBulkAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        plan_id: z.string().uuid(),
        only_ids: z.array(z.string().uuid()).max(BULK_SELECTION_CAP).optional(),
        // Resume point in the plan's eligible rows; omit to continue from the
        // last persisted cursor.
        cursor: z.number().int().min(0).optional(),
        batch_size: z.number().int().min(1).max(BULK_EXEC_BATCH).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<ExecResult> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { executePlan } = await import("./bulk-actions.server");
    return executePlan(supabaseAdmin, context.userId, data.plan_id, {
      ...(data.only_ids ? { onlyIds: data.only_ids } : {}),
      ...(data.cursor === undefined ? {} : { cursor: data.cursor }),
      ...(data.batch_size === undefined ? {} : { batchSize: data.batch_size }),
    });
  });
