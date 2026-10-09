import {
  BLUEPRINT_IN_PROGRESS_STATUSES,
  BLUEPRINT_MAX_AUTO_ATTEMPTS,
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
  // Oldest first, and never a row past the automatic attempt budget: without
  // the cap, exhausted rows were re-selected every tick and could crowd out
  // newly queued roles behind the limit.
  const COLUMNS = "id, status, blueprint_status, blueprint_attempts, blueprint_error, updated_at";
  const [{ data: waiting }, { data: stuck }] = await Promise.all([
    admin
      .from("positions")
      .select(COLUMNS)
      .or("blueprint_status.in.(queued,failed,not_started),blueprint_status.is.null")
      .lt("updated_at", cutoff)
      .lt("blueprint_attempts", BLUEPRINT_MAX_AUTO_ATTEMPTS)
      .order("updated_at", { ascending: true })
      .limit(limit),
    admin
      .from("positions")
      .select(COLUMNS)
      .in("blueprint_status", [...BLUEPRINT_IN_PROGRESS_STATUSES])
      .lt("updated_at", staleCutoff)
      .lt("blueprint_attempts", BLUEPRINT_MAX_AUTO_ATTEMPTS)
      .order("updated_at", { ascending: true })
      .limit(limit),
  ]);

  const rows = [...(stuck ?? []), ...(waiting ?? [])].slice(0, limit);
  const results: DrainResult[] = [];
  const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
  for (const row of rows) {
    // One decision, shared with the role page: a failure that needs a person
    // (unreadable description, missing API key) is not retried in the
    // background, and a live/paused/closed role is never re-analysed.
    const decision = analysisDecision(row);
    if (!decision.shouldStart) {
      results.push({
        id: row.id,
        status: row.blueprint_status,
        result: decision.state === "exhausted" ? "attempts_exhausted" : `skipped:${decision.state}`,
      });
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
