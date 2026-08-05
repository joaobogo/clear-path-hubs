// Thin server-function wrapper for the candidate audit history timeline.
// Read-only by design: there is no mutation entry point for history.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { CandidateHistory } from "./candidate-history.server";

export const getCandidateHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<CandidateHistory> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadCandidateHistory } = await import("./candidate-history.server");
    return loadCandidateHistory(supabaseAdmin as never, { matchId: data.match_id });
  });
