/**
 * The read-state decision, kept pure so it can be tested without a DOM.
 *
 * Every dashboard surface must resolve to exactly one of these phases, and
 * "loading" must never be reachable forever: once a first read has been
 * pending past the backstop it becomes "stuck", which renders as a failure
 * with a reason and a Retry.
 */
export type QueryPhase =
  | "loading"
  | "stuck"
  | "error"
  | "empty"
  | "filtered-empty"
  | "data";

export function resolveQueryPhase(input: {
  /** First read in flight. */
  pending: boolean;
  /** Some data — fresh or previously loaded — is available to render. */
  hasData: boolean;
  isError?: boolean;
  /** Pending for longer than the bounded wait. */
  stuck?: boolean;
  /** Data is present but means "nothing to show". */
  empty?: boolean;
  /** Caller has filters applied, so a zero is a filtered zero. */
  hasFilters?: boolean;
}): QueryPhase {
  const { pending, hasData, isError, stuck, empty, hasFilters } = input;

  if (!hasData) {
    if (stuck) return "stuck";
    if (isError) return "error";
    // Settled with no data and no error means a gate hasn't enabled the read
    // yet. That still shows a skeleton — but the stuck backstop above is timed
    // from "no data", not from "pending", so it can never wait forever.
    return "loading";
  }

  if (empty) return hasFilters ? "filtered-empty" : "empty";
  return "data";
}
