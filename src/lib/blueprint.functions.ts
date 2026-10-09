import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { analysisDecision, isPositionAnalysable } from "@/lib/blueprint-trigger";

const input = z.object({ positionId: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function adminClient(): Promise<AnyRow> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as AnyRow;
}

/**
 * Loads the role and checks the caller's seat. "read": any workspace member
 * or staff. "write": editors, admins and staff in their own console — a
 * read-only viewer seat, or staff in support view, may not start the writes
 * a pipeline run makes.
 */
async function loadPositionFor(userId: string, positionId: string, access: "read" | "write") {
  const admin = await adminClient();
  const { data: pos } = await admin
    .from("positions")
    .select(
      "id, organization_id, status, blueprint_status, blueprint_attempts, blueprint_error, updated_at",
    )
    .eq("id", positionId)
    .maybeSingle();
  if (!pos) throw new Error("position_not_found");
  const { assertWorkspaceAccess, assertWorkspaceWrite } = await import("@/lib/authz/workspace-access");
  if (access === "write") await assertWorkspaceWrite(admin, userId, pos.organization_id as string);
  else await assertWorkspaceAccess(admin, userId, pos.organization_id as string);
  return pos as AnyRow;
}

/**
 * Deliberate re-run of the Role Blueprint for one position ("Try analysis
 * again").
 *
 * Authorization: the caller must be able to WRITE in the role's workspace —
 * the run rewrites the brief, so a viewer seat cannot start it. (This used
 * to run for any signed-in user and any position id.) Re-entrancy is guarded
 * by the same conditional claim the background runner uses, so a double
 * click, or a second tab, cannot start two runs: a live run is never taken
 * over, only a finished or dead one.
 */
export const retryBlueprintAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }) => {
    await loadPositionFor(context.userId as string, data.positionId, "write");
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
    // Read access is enough: the analysis is the system's own setup work on
    // a brand-new role, not an edit by the viewer, and it is idempotent and
    // capped. What a viewer cannot do is start it on a role that is already
    // live, paused or closed — refused here as well as on the page.
    const pos = await loadPositionFor(context.userId as string, data.positionId, "read");
    if (!isPositionAnalysable(pos.status)) {
      return { ok: true, started: false, state: "skipped" as const, reason: "role_status_not_analysable" };
    }
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
