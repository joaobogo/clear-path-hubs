import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildWeeklyUpdate } from "@/lib/client-weekly-update.server";
import type { WeeklyUpdate } from "@/lib/client-weekly-update";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";

/** "This week" card data for the signed-in client account. RLS scopes the reads. */
export const getWeeklyUpdate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<WeeklyUpdate> => {
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);

    return buildWeeklyUpdate(context.supabase, data.orgId);
  });
