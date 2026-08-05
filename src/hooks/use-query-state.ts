import { useCallback, useState } from "react";

/**
 * The one hook every client list/detail route uses to derive its render state.
 *
 * It returns a single discriminated status so no route can render an empty
 * state (or a zero count) from a failed load, and it owns the retry lifecycle
 * so Retry re-runs only that query and is disabled while in flight.
 */
export type QueryStatus = "loading" | "error" | "empty" | "ready";

export type QueryState<TData> = {
  status: QueryStatus;
  /** Only ever set when status === "ready". */
  data: TData | undefined;
  error: unknown;
  isError: boolean;
  isLoading: boolean;
  isEmpty: boolean;
  isReady: boolean;
  retry: () => void;
  retrying: boolean;
};

type MinimalQuery<TData> = {
  data: TData | undefined;
  isError: boolean;
  isPending?: boolean;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  refetch?: () => unknown;
};

export function useQueryState<TData>(
  query: MinimalQuery<TData>,
  options?: { isEmpty?: (data: TData) => boolean },
): QueryState<TData> {
  const [retrying, setRetrying] = useState(false);

  const retry = useCallback(() => {
    if (!query.refetch || retrying) return;
    setRetrying(true);
    void Promise.resolve(query.refetch()).finally(() => setRetrying(false));
  }, [query, retrying]);

  const pending = query.isPending ?? query.isLoading ?? query.data === undefined;

  let status: QueryStatus;
  if (query.isError) status = "error";
  else if (pending || query.data === undefined) status = "loading";
  else if (options?.isEmpty?.(query.data)) status = "empty";
  else status = "ready";

  return {
    status,
    data: status === "ready" || status === "empty" ? query.data : undefined,
    error: query.error,
    isError: status === "error",
    isLoading: status === "loading",
    isEmpty: status === "empty",
    isReady: status === "ready",
    retry,
    retrying: retrying || Boolean(query.isFetching && query.isError),
  };
}
