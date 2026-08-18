import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getEmptyStateSignals,
  type EmptyStateSignals,
} from "@/lib/empty-state-signals.functions";

/**
 * Real signals behind every empty state: is a role live, has discovery run, is
 * anything processing now. Only fetched when a surface actually has nothing to
 * show, so an empty screen never guesses.
 */
export function useEmptyStateSignals(
  orgId: string | undefined,
  options?: { enabled?: boolean; positionId?: string },
): EmptyStateSignals | undefined {
  const fn = useServerFn(getEmptyStateSignals);
  const enabled = Boolean(orgId) && (options?.enabled ?? true);
  const { data } = useQuery({
    queryKey: ["empty-state-signals", orgId ?? null, options?.positionId ?? null],
    queryFn: () =>
      fn({
        data: {
          orgId: orgId!,
          ...(options?.positionId ? { positionId: options.positionId } : {}),
        },
      }),
    enabled,
    staleTime: 30_000,
  });
  return data;
}

/**
 * Same read, but with the resolution state exposed.
 *
 * An empty state is a conclusion, so it may only be rendered from a RESOLVED
 * response. Surfaces that draw a verdict ("nobody qualified") use this hook and
 * hold a skeleton until `resolved` is true.
 */
export function useEmptyStateSignalsQuery(
  orgId: string | undefined,
  options?: { enabled?: boolean; positionId?: string },
): {
  signals: EmptyStateSignals | undefined;
  resolved: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  retrying: boolean;
} {
  const fn = useServerFn(getEmptyStateSignals);
  const enabled = Boolean(orgId) && (options?.enabled ?? true);
  const query = useQuery({
    queryKey: ["empty-state-signals", orgId ?? null, options?.positionId ?? null],
    queryFn: () =>
      fn({
        data: {
          orgId: orgId!,
          ...(options?.positionId ? { positionId: options.positionId } : {}),
        },
      }),
    enabled,
    staleTime: 30_000,
  });
  return {
    signals: query.data,
    resolved: query.data !== undefined,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
    retrying: query.isFetching,
  };
}
