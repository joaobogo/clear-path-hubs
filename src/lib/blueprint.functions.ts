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

/**
 * Staff-only backfill: drain all blueprint jobs stuck in a non-terminal state
 * for more than 5 minutes. Used to repair the legacy draft roles that were stuck
 * at Stage 1/2 before the event-driven pipeline fix.
 */
export const backfillStuckBlueprints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { data: stuck } = await admin
      .from("positions")
      .select("id, blueprint_status, blueprint_attempts")
      .or("blueprint_status.in.(queued,failed,not_started),blueprint_status.is.null")
      .lt("updated_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(50);

    const results: { id: string; ok: boolean; reason?: string }[] = [];
    for (const row of stuck ?? []) {
      if ((row.blueprint_attempts ?? 0) >= 5) {
        results.push({ id: row.id, ok: false, reason: "attempts_exhausted" });
        continue;
      }
      try {
        const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
        const res = await runBlueprintForPosition(row.id);
        results.push({ id: row.id, ok: res.ok, reason: res.reason });
      } catch (err) {
        results.push({ id: row.id, ok: false, reason: String(err) });
      }
    }

    return { ok: true, drained: results.length, results };
  });
