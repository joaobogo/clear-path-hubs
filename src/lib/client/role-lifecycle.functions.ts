// Thin server-function wrapper for the client-facing role states.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setClientRoleState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        positionId: z.string().uuid(),
        state: z.enum(["active", "paused", "archived"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { runSetRoleState } = await import("./role-lifecycle.server");
    return runSetRoleState({
      userId: context.userId,
      positionId: data.positionId,
      state: data.state,
    });
  });
