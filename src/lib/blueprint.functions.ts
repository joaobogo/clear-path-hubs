import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { analysisDecision, BLUEPRINT_STALE_MS } from "@/lib/blueprint-trigger";

const input = z.object({ positionId: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function adminClient(): Promise<AnyRow> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as AnyRow;
}

/** The caller must be able to see the role's workspace (or be staff). */
async function assertCanSeePosition(userId: string, positionId: string) {
  const admin = await adminClient();
  const { data: pos } = await admin
    .from("positions")
    .select("id, organization_id, blueprint_status, blueprint_attempts, blueprint_error, updated_at")
    .eq("id", positionId)
    .maybeSingle();
  if (!pos) throw new Error("position_not_found");
  const { assertWorkspaceAccess } = await import("@/lib/authz/workspace-access");
  await assertWorkspaceAccess(admin, userId, pos.organization_id as string);
  return pos as AnyRow;
}

/**
 * Deliberate re-run of the Role Blueprint for one position ("Try analysis
 * again").
 *
 * Authorization: the caller must have access to the role's workspace. (This
 * used to run for any signed-in user and any position id.) Re-entrancy is
 * guarded by the same conditional claim the background runner uses, so a
 * double click cannot start two runs.
 */
export const retryBlueprintAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }) => {
    await assertCanSeePosition(context.userId as string, data.positionId);
    const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
    return runBlueprintForPosition(data.positionId, { force: true });
  });

/**
 * Start the role analysis if — and only if — it needs starting: queued and
 * never picked up, a run that died mid-way, or one transient failure. Called
 * automatically by the role page; idempotent, so any number of open tabs
 * start at most one run.
 *
 * The run is awaited INSIDE this request on purpose: on Workers, work left
 * running after a response is dropped. The page does not wait for the answer —
 * it polls the role and shows "Analysing your role…" meanwhile.
 */
export const ensureRoleAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }) => {
    const pos = await assertCanSeePosition(context.userId as string, data.positionId);
    const decision = analysisDecision(pos);
    if (!decision.shouldStart) {
      return { ok: true, started: false, state: decision.state, reason: null as string | null };
    }
    const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
    const res = await runBlueprintForPosition(data.positionId);
    return {
      ok: res.ok,
      started: res.reason !== "already_running",
      state: decision.state,
      reason: res.reason ?? null,
    };
  });

/**
 * Staff-only backfill: drain blueprint jobs that are queued/failed, or
 * "in progress" with no heartbeat for BLUEPRINT_STALE_MS.
 */
export const backfillStuckBlueprints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await adminClient();
    const { data: staff } = await admin.rpc("is_platform_staff", { _user: context.userId });
    if (staff !== true) throw new Error("forbidden");
    const { drainStuckBlueprints } = await import("@/lib/blueprint-drain.server");
    const results = await drainStuckBlueprints(admin, 50);
    return {
      ok: true,
      drained: results.length,
      results: results.map((r) => ({ id: r.id, ok: r.result === "started", reason: r.result })),
    };
  });

export { BLUEPRINT_STALE_MS };
