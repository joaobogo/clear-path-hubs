// Thin server-function wrapper for the position bottleneck diagnosis card.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { PositionBottleneck } from "./admin-position-bottleneck.server";

export const getPositionBottleneck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ position_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<PositionBottleneck> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPositionBottleneck } = await import("./admin-position-bottleneck.server");
    return loadPositionBottleneck(supabaseAdmin as never, data.position_id);
  });
