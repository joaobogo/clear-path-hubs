/**
 * Staff-gated server functions for the candidate next-action bar.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getCandidateNextAction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ match_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadNextAction } = await import("./candidate-next-action.server");
    return loadNextAction(supabaseAdmin as never, data.match_id);
  });

export const reassignCandidateNextStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        assignee_user_id: z.string().uuid().nullable(),
        step: z.string().min(1).max(80),
        task_type: z.string().min(1).max(60),
        title: z.string().trim().min(2).max(240),
        note: z.string().trim().max(2000).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assignNextStep } = await import("./candidate-next-action.server");
    return assignNextStep(supabaseAdmin as never, {
      matchId: data.match_id,
      assigneeUserId: data.assignee_user_id,
      actorUserId: context.userId,
      step: data.step,
      taskType: data.task_type,
      title: data.title,
      note: data.note ?? null,
    });
  });

export const addCandidateBlockingNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        body: z.string().trim().min(4).max(2000),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { addBlockingNote } = await import("./candidate-next-action.server");
    return addBlockingNote(supabaseAdmin as never, {
      matchId: data.match_id,
      body: data.body,
      actorUserId: context.userId,
    });
  });
