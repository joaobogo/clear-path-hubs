// Thin server-function wrapper for the admin portfolio health table.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { PortfolioHealth } from "./admin-portfolio.server";

export const getPortfolioHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ include_test: z.boolean().optional().default(false) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<PortfolioHealth> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPortfolioHealth } = await import("./admin-portfolio.server");
    return loadPortfolioHealth(supabaseAdmin as never, { includeTest: data.include_test });
  });
