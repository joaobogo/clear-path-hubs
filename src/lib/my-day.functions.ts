import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const schema = z.object({ include_test: z.boolean().optional() });

export const getMyDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => schema.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any;
    const { data: staff } = await s.rpc("is_platform_staff", { _user: context.userId });
    if (staff !== true) throw new Error("forbidden");

    const { loadMyDay } = await import("./my-day.server");
    const { resolveShowTestRecordsForUser } = await import("./admin-test-scope.server");
    const includeTest =
      data.include_test ?? (await resolveShowTestRecordsForUser(s, context.userId));

    return loadMyDay(s, { userId: context.userId, includeTest });
  });
