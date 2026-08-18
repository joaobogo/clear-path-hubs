/**
 * Why this exists: a skeleton must never be a terminal state.
 *
 * Most client panels are gated on a context query ("which workspace am I in?")
 * and only run once an organization id is known:
 *
 *   const q = useQuery({ ..., enabled: !!orgId })
 *
 * When the gate itself fails — the context call errors, or it returns a user
 * with no active workspace — every dependent query stays `enabled: false`
 * forever. `isFetching` is false, `isError` is false, and `data` is undefined,
 * so a panel that renders `loading ? <Skeleton/> : ...` off `isFetching` shows
 * a grey block that never resolves. Nothing retries, because nothing failed.
 *
 * `orgGate` turns that silent hole into an explicit failure, and
 * `useStuckAfter` is the last-resort backstop: any panel still pending after a
 * bounded wait is reported as failed so the user gets a reason and a Retry.
 */

import { useEffect, useState } from "react";

/** Anything shaped like the React Query result we need. */
export type GateQueryLike = {
  data?: unknown;
  isError: boolean;
  isFetching: boolean;
  isPending?: boolean;
  isLoading?: boolean;
  error?: unknown;
  refetch: () => unknown;
};

export type OrgGate = {
  /** Resolved workspace id, when there is one. */
  orgId: string | undefined;
  /** The gate is still resolving — dependent panels may show a skeleton. */
  pending: boolean;
  /** The gate will not produce an org id: error, or no workspace at all. */
  failed: boolean;
  /** Set when the gate failed because the caller has no workspace. */
  noWorkspace: boolean;
  error: unknown;
  retry: () => void;
  retrying: boolean;
};

const NO_WORKSPACE = new Error(
  "This account isn't attached to a workspace yet, so there is nothing to load.",
);

export function orgGate(query: GateQueryLike, orgId: string | undefined): OrgGate {
  const settled = !(query.isPending ?? query.isLoading ?? query.data === undefined);
  const errored = query.isError && query.data === undefined;
  const noWorkspace = settled && !errored && !orgId;

  return {
    orgId,
    pending: !settled && !errored,
    failed: errored || noWorkspace,
    noWorkspace,
    error: errored ? (query.error ?? new Error("The workspace lookup failed.")) : noWorkspace ? NO_WORKSPACE : undefined,
    retry: () => {
      void query.refetch();
    },
    retrying: query.isFetching,
  };
}

/** Default backstop: generous enough for a cold server function, short enough to not look broken. */
export const STUCK_AFTER_MS = 12_000;

/**
 * True once `active` has been continuously true for `ms`. Resets the moment
 * `active` goes false, so a normal load never trips it.
 */
export function useStuckAfter(active: boolean, ms: number = STUCK_AFTER_MS): boolean {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!active) {
      setStuck(false);
      return;
    }
    const timer = setTimeout(() => setStuck(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);

  return active && stuck;
}

export const STUCK_ERROR = new Error(
  "This took longer than expected and stopped loading. Retry to try again.",
);

/**
 * The one call a panel needs: is it loading, is it broken, and why.
 *
 * `loading` is only ever true while something is genuinely in flight and not
 * yet stuck, which is what makes a terminal skeleton impossible.
 */
export function panelState(args: {
  gate: OrgGate;
  /** The panel's own query state. */
  hasData: boolean;
  isFetching: boolean;
  isError: boolean;
  error?: unknown;
  stuck?: boolean;
}): { loading: boolean; isError: boolean; error: unknown } {
  const { gate, hasData, isFetching, isError, error, stuck } = args;

  if (gate.failed) return { loading: false, isError: true, error: gate.error };
  if (isError && !hasData) return { loading: false, isError: true, error };
  if (stuck && !hasData) return { loading: false, isError: true, error: STUCK_ERROR };

  const inFlight = !hasData && (gate.pending || isFetching || !gate.orgId);
  return { loading: inFlight, isError: false, error: undefined };
}
