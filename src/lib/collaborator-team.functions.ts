import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertWorkspaceArea } from "@/lib/collaborator-roles.server";

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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: org }, { data: seats }] = await Promise.all([
      supabaseAdmin
        .from("organizations")
        .select("client_seat_limit")
        .eq("id", data.orgId)
        .maybeSingle(),
      supabaseAdmin
        .from("memberships")
        .select("id")
        .eq("organization_id", data.orgId)
        .in("role", ["client_admin", "client_editor", "client_viewer"])
        .in("status", ["active", "invited"]),
    ]);

    const recruiterSeats =
      (org as { client_seat_limit?: number | null } | null)?.client_seat_limit ?? 3;
    // The owner seat sits on top of the recruiter seat allowance.
    const seatLimit = recruiterSeats + 1;
    const seatsUsed = ((seats as { id: string }[] | null) ?? []).length;

    return { seatLimit, seatsUsed, seatsLeft: Math.max(0, seatLimit - seatsUsed) };
  });
