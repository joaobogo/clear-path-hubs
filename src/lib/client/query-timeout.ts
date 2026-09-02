/**
 * Bounded client reads.
 *
 * A hung server function renders as eternal loading: no data, no error,
 * nothing to retry. Wrapping a query here turns an unresolved request into a
 * real failure with a Retry inside a bounded time, instead of a permanent
 * skeleton.
 *
 * COVERAGE IS PARTIAL, and the wording here used to claim otherwise — "every
 * client query that a section's loading state depends on is wrapped here" was
 * true of about fifteen of them. The overview and the other high-traffic
 * dashboard reads are bounded; most panels, dialogs and settings tabs are not.
 *
 * Wrapping the rest is a deliberate trade, not an obvious win: too low a cap
 * turns a slow-but-successful read on a poor connection into a failure. If you
 * extend coverage, raise the ceiling for the heavy reads rather than applying
 * this default everywhere.
 *
 * THE CAP MUST EXCEED THE READ IT WRAPS, or it manufactures the failure it
 * exists to report. At 12s it did: the launch test pass (2 Sep) measured client
 * workspace pages taking roughly 15–18s to become readable in production, so
 * /client/candidates rendered "We couldn't load your candidates — this took
 * longer than expected and stopped loading" on a cold load, while the KPI strip
 * above it succeeded and read 0. It looked org-specific — it was first seen on
 * a workspace with no candidates at all — but every loader in that handler
 * early-returns on an empty list, so an empty workspace is the fast case. The
 * cause was the ceiling, not the org, and it could fire on any workspace.
 *
 * Retry could not clear it either: refetch re-runs the same read against the
 * same ceiling.
 *
 * 30s is above the observed load and still bounded, so a genuine hang is still
 * reported rather than spinning forever (which is what this exists to prevent).
 * It is a floor under a symptom, not a fix for the latency — that needs
 * profiling the client reads in production, and is worth doing.
 */

export const QUERY_TIMEOUT_MS = 30_000;

export class QueryTimeoutError extends Error {
  constructor() {
    super("This took longer than expected and was stopped. Retry to try again.");
    this.name = "QueryTimeoutError";
  }
}

export function withQueryTimeout<T>(
  work: Promise<T> | (() => Promise<T>),
  ms: number = QUERY_TIMEOUT_MS,
): Promise<T> {
  const promise = typeof work === "function" ? work() : work;
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new QueryTimeoutError()), ms);
    }),
  ]);
}
