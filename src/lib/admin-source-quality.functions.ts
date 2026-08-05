// Thin server-function wrappers for sourcing channel quality.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { PositionSourceQuality } from "./admin-source-quality.server";
import type { SourceQuality } from "./source-quality";

export const getPositionSourceQuality = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ position_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<PositionSourceQuality> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPositionSourceQuality } = await import("./admin-source-quality.server");
    return loadPositionSourceQuality(supabaseAdmin as never, data.position_id);
  });

export const getSourceQualityRollup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ include_test: z.boolean().optional().default(false) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<SourceQuality> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSourceQualityRollup } = await import("./admin-source-quality.server");
    return loadSourceQualityRollup(supabaseAdmin as never, { includeTest: data.include_test });
  });
