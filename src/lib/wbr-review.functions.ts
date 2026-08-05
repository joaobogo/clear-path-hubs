import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({
  week_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "week_start must be YYYY-MM-DD")
    .optional(),
  include_test: z.boolean().optional(),
});

export const getWeeklyOperatingReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => schema.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any;
    const { data: staff } = await s.rpc("is_platform_staff", { _user: context.userId });
    if (staff !== true) throw new Error("forbidden");

    const { loadWeeklyReview, currentWeekStart } = await import("./wbr-review.server");
    return loadWeeklyReview(s, {
      weekStart: data.week_start ?? currentWeekStart(),
      includeTest: data.include_test ?? false,
    });
  });
