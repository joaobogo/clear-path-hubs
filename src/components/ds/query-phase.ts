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
    if (pending) return "loading";
    // Settled, no error, no data: nothing will arrive on its own.
    return "stuck";
  }

  if (empty) return hasFilters ? "filtered-empty" : "empty";
  return "data";
}
