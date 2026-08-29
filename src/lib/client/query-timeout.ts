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
 * Wrapping the rest is a deliberate trade, not an obvious win: a 12s cap would
 * turn a slow-but-successful analytics read on a poor connection into a
 * failure. If you extend coverage, raise the ceiling for the heavy reads
 * rather than applying this default everywhere.
 */

export const QUERY_TIMEOUT_MS = 12_000;

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
