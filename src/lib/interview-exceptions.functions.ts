// Thin server-function wrappers for interview logistics exceptions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { InterviewExceptions } from "./interview-exceptions";

export const getInterviewExceptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        position_id: z.string().uuid().optional(),
        include_test: z.boolean().optional().default(false),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<InterviewExceptions> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadInterviewExceptions } = await import("./interview-exceptions.server");
    return loadInterviewExceptions(supabaseAdmin as never, {
      ...(data.position_id ? { positionId: data.position_id } : {}),
      includeTest: data.include_test,
    });
  });

export const nudgeInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        interview_id: z.string().uuid(),
        kind: z.enum(["confirmation", "scorecard"]),
        note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordInterviewNudge } = await import("./interview-exceptions.server");
    return recordInterviewNudge(supabaseAdmin as never, {
      interviewId: data.interview_id,
      actorUserId: context.userId,
      kind: data.kind,
      ...(data.note ? { note: data.note } : {}),
    });
  });

export const recordInterviewOutcomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        interview_id: z.string().uuid(),
        outcome: z.enum(["completed", "no_show", "cancelled", "needs_rescheduling"]),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordInterviewOutcome } = await import("./interview-exceptions.server");
    return recordInterviewOutcome(supabaseAdmin as never, {
      interviewId: data.interview_id,
      actorUserId: context.userId,
      outcome: data.outcome,
      reason: data.reason,
    });
  });
