// Thin server-function wrappers for the processing exception board.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ExceptionBoard, RetryOutcome } from "./admin-processing-exceptions.server";

export const getProcessingExceptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExceptionBoard> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadExceptionBoard } = await import("./admin-processing-exceptions.server");
    return loadExceptionBoard(supabaseAdmin as never);
  });

export const retryProcessingException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ job_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<RetryOutcome> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { retryProcessingJob } = await import("./admin-processing-exceptions.server");
    return retryProcessingJob(supabaseAdmin as never, data.job_id, context.userId);
  });

export const retryPositionProcessingExceptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ position_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ outcomes: RetryOutcome[] }> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { retryPositionExceptions } = await import("./admin-processing-exceptions.server");
    const outcomes = await retryPositionExceptions(
      supabaseAdmin as never,
      data.position_id,
      context.userId,
    );
    return { outcomes };
  });

export const markProcessingJobPermanentlyFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ job_id: z.string().uuid(), reason: z.string().trim().min(10).max(1000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { markJobPermanentlyFailed } = await import("./admin-processing-exceptions.server");
    return markJobPermanentlyFailed(
      supabaseAdmin as never,
      data.job_id,
      data.reason,
      context.userId,
    );
  });
