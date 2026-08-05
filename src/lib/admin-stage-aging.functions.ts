// Thin server-function wrappers for the position stage-aging panel.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PIPELINE_STAGES } from "./stage-aging";
import type { PositionStageAging } from "./admin-stage-aging.server";

export const getPositionStageAging = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ position_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<PositionStageAging> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPositionStageAging } = await import("./admin-stage-aging.server");
    return loadPositionStageAging(supabaseAdmin as never, data.position_id);
  });

export const moveCandidateStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        to_stage: z.enum(PIPELINE_STAGES),
        reason: z.string().trim().min(10, "Give a reason of at least 10 characters"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { moveCandidateStageWithReason } = await import("./admin-stage-aging.server");
    return moveCandidateStageWithReason(supabaseAdmin as never, {
      matchId: data.match_id,
      toStage: data.to_stage,
      reason: data.reason,
      actorUserId: context.userId,
    });
  });
