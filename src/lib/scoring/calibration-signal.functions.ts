/**
 * Platform-staff-only read of the score-versus-outcome calibration signal
 * (audit finding 12). See calibration-signal.ts for the math and
 * calibration-signal.server.ts for how rows are loaded.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CalibrationSignal } from "./calibration-signal";

export const getCalibrationSignal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ include_test: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }): Promise<CalibrationSignal> => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadCalibrationSignal } = await import("./calibration-signal.server");
    return loadCalibrationSignal(supabaseAdmin as never, {
      includeTest: data.include_test ?? false,
    });
  });
