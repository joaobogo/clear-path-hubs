// Thin server-function wrappers for position lifecycle + duplication.
// All runtime logic lives in position-lifecycle.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const setPositionLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        positionId: z.string().uuid(),
        action: z.enum(["submit", "publish", "pause", "resume", "close", "reopen", "archive"]),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { runLifecycleTransition } = await import("./position-lifecycle.server");
    return runLifecycleTransition({
      userId: context.userId,
      positionId: data.positionId,
      action: data.action,
      reason: data.reason,
    });
  });

export const duplicatePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        positionId: z.string().uuid(),
        title: z.string().trim().min(2).max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { runDuplicatePosition } = await import("./position-lifecycle.server");
    return runDuplicatePosition({
      userId: context.userId,
      positionId: data.positionId,
      title: data.title,
    });
  });
