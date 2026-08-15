import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Publish-gate queue for admin. Staff only; reasons come from the shared gate. */
export const getPublishGateQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { includeTest?: boolean; q?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
    if (!staff) throw new Error("Only platform staff can view publish blockers.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPublishGateQueue } = await import("./publish-gate.server");
    return await loadPublishGateQueue(supabaseAdmin, { 
      includeTest: data.includeTest ?? false,
      q: data.q 
    });
  });
