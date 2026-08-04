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
