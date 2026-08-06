/**
 * Role lifecycle — thin server-function wrapper.
 * Implementation lives in role-lifecycle.server.ts so the role-detail payload
 * can reuse it in the same round trip.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RoleLifecycle } from "@/lib/role-lifecycle/role-lifecycle";

export const getRoleLifecycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId: string }) =>
    z.object({ orgId: z.string().uuid(), positionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<RoleLifecycle | null> => {
    const { loadRoleLifecycle } = await import("@/lib/role-lifecycle/role-lifecycle.server");
    return loadRoleLifecycle(context.supabase, data);
  });
