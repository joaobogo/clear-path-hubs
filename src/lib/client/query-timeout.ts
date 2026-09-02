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
 * exists to report. /client/candidates rendered "We couldn't load your
 * candidates — this took longer than expected and stopped loading" on a
 * workspace whose KPI strip above it loaded fine and read 0 (launch pass,
 * 2 Sep). Retry could not clear it: refetch re-runs the same read against the
 * same ceiling.
 *
 * BE HONEST ABOUT WHAT IS KNOWN HERE. That failure was first explained by page
 * loads of "15–18s", which would have put every read past a 12s cap. The tester
 * then retracted that figure — it measured their own fixed wait, not the app.
 * Polled properly the dashboard resolves in 6–7s and the candidate list renders
 * its first row at 4.7s, so 12s already had roughly twice the headroom it
 * needed, and the observed failure is NOT explained by the ceiling alone.
 * Its root cause is still unknown: it was seen on a workspace with no
 * candidates, yet every loader in that handler early-returns on an empty list,
 * so the empty case is the fast path.
 *
 * 20s is therefore headroom, not a diagnosis — about 3x the observed load, so a
 * slow cold start cannot trip it, while a genuine hang still surfaces well
 * inside a minute rather than spinning forever (the thing this exists to
 * prevent). Reproducing that failure with a real client login is what would
 * actually settle it.
 */

export const QUERY_TIMEOUT_MS = 20_000;

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
