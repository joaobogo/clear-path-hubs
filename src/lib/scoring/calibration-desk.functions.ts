/**
 * Platform-staff-only read for the calibration desk (Wave 4, prompt 12).
 * Math lives in calibration-desk.ts; row loading in calibration-desk.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CalibrationDesk } from "./calibration-desk";

export const getCalibrationDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ include_test: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<CalibrationDesk> => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadCalibrationDesk } = await import("./calibration-desk.server");
    return loadCalibrationDesk(supabaseAdmin as never, {
      includeTest: data.include_test ?? false,
    });
  });
