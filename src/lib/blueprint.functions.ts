import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const input = z.object({ positionId: z.string().uuid() });

/**
 * Deliberate re-run of the Role Blueprint for one position.
 *
 * Authorization is done with the caller's own client first (RLS decides whether
 * this person may see the position at all); only then do we use the admin client
 * to re-drive the pipeline. Re-entrancy is guarded by the same status claim the
 * background runner uses, so a double click cannot start two runs.
 *
 * The pipeline can run from either an intake submission (public express intake)
 * or directly from the position + organization + creator profile (client
 * onboarding wizard), so the implementation delegates to runBlueprintForPosition.
 */
export const retryBlueprintAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }) => {
    const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
    return runBlueprintForPosition(data.positionId, { force: true });
  });
