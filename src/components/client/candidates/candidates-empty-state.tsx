import { SurfaceState, SurfaceLoading } from "@/components/ds/surface-state";
import {
  resolveFilteredEmptyState,
  resolveNoCandidatesState,
} from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignalsQuery } from "@/hooks/use-empty-state-signals";
import { QueryErrorCard } from "@/components/client/query-error";

export function CandidatesEmptyState({
  hasCandidates,
  activeFilters,
  onClear,
  orgId,
  positionId,
}: {
  hasCandidates: boolean;
  activeFilters: { key: string; label: string }[];
  onClear: () => void;
  orgId: string | undefined;
  /** When the list is filtered to one role, signals are scoped to that role. */
  positionId?: string;
}) {
  const filteredOut = hasCandidates && activeFilters.length > 0;
  const { signals, resolved, isError, error, refetch, retrying } = useEmptyStateSignalsQuery(orgId, {
    enabled: !filteredOut,
    ...(positionId ? { positionId } : {}),
  });

  if (filteredOut) {
    return (
      <SurfaceState
        content={resolveFilteredEmptyState(activeFilters.map((f) => f.label))}
        onAction={onClear}
      />
    );
  }

  // A verdict may only be drawn from a resolved response. Until then: skeleton.
  if (isError) {
    return (
      <QueryErrorCard
        title="We couldn't check this role's progress"
        error={error}
        onRetry={refetch}
        retrying={retrying}
      />
    );
  }
  if (!resolved || !signals) return <SurfaceLoading label="Checking this role's progress" />;

  return (
    <SurfaceState
      content={resolveNoCandidatesState({
        activeRoles: signals.activeRoles,
        rolesInSetup: signals.rolesInSetup,
        discoveryStarted: signals.discoveryStarted,
        inProcessing: signals.inProcessing,
        runsCompleted: signals.runsCompleted,
        runsRunning: signals.runsRunning,
        sourcing: signals.sourcing,
      })}
    />
  );
}
