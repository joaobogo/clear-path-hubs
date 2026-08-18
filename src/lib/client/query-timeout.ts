/**
 * Bounded client reads.
 *
 * A hung server function used to render as eternal loading: no data, no error,
 * nothing to retry. Every client query that a section's loading state depends
 * on is wrapped here, so an unresolved request becomes a real failure with a
 * Retry inside a bounded time instead of a permanent skeleton.
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
