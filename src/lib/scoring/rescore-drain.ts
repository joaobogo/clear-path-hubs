/**
 * Drain loop for "re-score all candidates".
 *
 * The server function scores one bounded batch per call — a workspace with
 * hundreds of candidates would time out if it tried to do the lot in one
 * request, and would leave half the roster on the old engine with no way to
 * tell which half. So the browser calls it repeatedly until there is nothing
 * left.
 *
 * Pure and transport-free so the loop itself is testable: the termination
 * condition and the accumulation are the parts that can silently be wrong
 * (spin forever, stop early, double-count), and none of that needs a network
 * or a signed-in admin to verify.
 */

export type RescoreBatch = {
  rescored: number;
  examined: number;
  failed: Array<{ id: string; error: string }>;
};

export type RescoreTotals = {
  rescored: number;
  failed: number;
  examined: number;
  passes: number;
  /** True when the loop stopped because it hit the pass ceiling, not because it finished. */
  hitPassLimit: boolean;
};

/**
 * Bounded far above any real workspace (200 x 50 = 10,000 candidates). It
 * exists so a server bug that always reports work cannot spin the browser
 * forever, not as a real limit.
 */
export const MAX_RESCORE_PASSES = 200;

export async function drainRescore(
  runBatch: () => Promise<RescoreBatch>,
  onProgress?: (totals: Omit<RescoreTotals, "hitPassLimit">) => void,
  maxPasses: number = MAX_RESCORE_PASSES,
): Promise<RescoreTotals> {
  let rescored = 0;
  let failed = 0;
  let examined = 0;
  let passes = 0;

  for (let i = 0; i < maxPasses; i += 1) {
    const batch = await runBatch();
    passes += 1;
    rescored += batch.rescored;
    failed += batch.failed.length;
    examined += batch.examined;
    onProgress?.({ rescored, failed, examined, passes });
    // A pass that re-scored nothing means every remaining match is already on
    // the current engine. Note this is `rescored`, not `examined`: the server
    // still examines rows it skips, so stopping on `examined === 0` would loop
    // forever once only up-to-date candidates remain.
    if (batch.rescored === 0) break;
  }

  return { rescored, failed, examined, passes, hitPassLimit: passes >= maxPasses };
}
