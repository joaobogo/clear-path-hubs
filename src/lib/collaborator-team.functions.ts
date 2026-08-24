import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertWorkspaceArea } from "@/lib/collaborator-roles.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/**
 * Seat usage for one workspace. Admin-only, enforced through the same area map
 * the /client/team page renders from. Invited seats count against the cap
 * because the seat is already reserved.
 */
export const getWorkspaceSeatUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    await assertWorkspaceArea(context.supabase, context.userId, data.orgId, "team");

    const { readSeatUsage } = await import("@/lib/client-team-seats.server");
    // One derivation, shared with the staff-side account summary: seats come
    // from the organisation membership table.
    return await readSeatUsage(data.orgId);
  });
