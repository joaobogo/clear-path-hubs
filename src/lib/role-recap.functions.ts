// Role recap — thin server-function wrapper.
//
// Reads only recorded events on one role: stage transitions, client decisions
// and the position's own brief date. Implementation lives in role-recap.server.ts
// so the single role-detail payload can reuse it.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertWorkspaceArea } from "@/lib/collaborator-roles.server";
import type { RoleRecap } from "@/lib/role-recap";

export const getRoleRecap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId: string }) =>
    z.object({ orgId: z.string().uuid(), positionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<RoleRecap | null> => {
    await assertWorkspaceArea(context.supabase, context.userId, data.orgId, "candidates");
    const { loadRoleRecap } = await import("@/lib/role-recap.server");
    return loadRoleRecap(context.supabase, data);
  });
