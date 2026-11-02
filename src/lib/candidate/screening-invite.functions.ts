// Staff action: email a candidate the link to answer the role's screening
// questions. Staff-only; the decision rules live in ./screening-invite.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendScreeningQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: match } = await supabaseAdmin
      .from("candidate_matches")
      .select("id,application_id")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!match?.application_id)
      throw new Error("This candidate has no application to send questions for.");
    const { sendScreeningInviteByStaff } = await import("./screening-invite.server");
    const out = await sendScreeningInviteByStaff(supabaseAdmin, {
      applicationId: match.application_id as string,
      actorUserId: context.userId,
    });
    if (!out.ok) throw new Error(out.message);
    return { ok: true as const, action: out.status, message: out.message };
  });
