import {
  BLUEPRINT_IN_PROGRESS_STATUSES,
  BLUEPRINT_STALE_MS,
  analysisDecision,
} from "@/lib/blueprint-trigger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export type DrainResult = { id: string; status: string; result: string };

/**
 * Roles whose analysis needs (re)starting: queued/failed/not_started for more
 * than the stale window, and — the case the old drain missed — roles stuck
 * "in progress" whose run was dropped and never touched the row again.
 */
export async function drainStuckBlueprints(admin: Admin, limit = 25): Promise<DrainResult[]> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const staleCutoff = new Date(Date.now() - BLUEPRINT_STALE_MS).toISOString();
  const [{ data: waiting }, { data: stuck }] = await Promise.all([
    admin
      .from("positions")
      .select("id, blueprint_status, blueprint_attempts, blueprint_error, updated_at")
      .or("blueprint_status.in.(queued,failed,not_started),blueprint_status.is.null")
      .lt("updated_at", cutoff)
      .limit(limit),
    admin
      .from("positions")
      .select("id, blueprint_status, blueprint_attempts, blueprint_error, updated_at")
      .in("blueprint_status", [...BLUEPRINT_IN_PROGRESS_STATUSES])
      .lt("updated_at", staleCutoff)
      .limit(limit),
  ]);

  const rows = [...(stuck ?? []), ...(waiting ?? [])].slice(0, limit);
  const results: DrainResult[] = [];
  const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
  for (const row of rows) {
    const decision = analysisDecision(row);
    // The drain is a background safety net: it retries failures too, but
    // never past the automatic attempt budget.
    if (decision.state === "exhausted") {
      results.push({ id: row.id, status: row.blueprint_status, result: "attempts_exhausted" });
      continue;
    }
    try {
      const res = await runBlueprintForPosition(row.id);
      results.push({
        id: row.id,
        status: res.status ?? row.blueprint_status,
        result: res.ok ? "started" : (res.reason ?? "no_change"),
      });
    } catch (err) {
      results.push({ id: row.id, status: row.blueprint_status, result: String(err) });
    }
  }
  return results;
}
