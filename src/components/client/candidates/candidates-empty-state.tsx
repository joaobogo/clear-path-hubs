import { SurfaceState } from "@/components/ds/surface-state";
import {
  resolveFilteredEmptyState,
  resolveNoCandidatesState,
} from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignals } from "@/hooks/use-empty-state-signals";

export function CandidatesEmptyState({
  hasCandidates,
  activeFilters,
  onClear,
  orgId,
}: {
  hasCandidates: boolean;
  activeFilters: { key: string; label: string }[];
  onClear: () => void;
  orgId: string | undefined;
}) {
  const filteredOut = hasCandidates && activeFilters.length > 0;
  const signals = useEmptyStateSignals(orgId, { enabled: !filteredOut });
  if (filteredOut) {
    return (
      <SurfaceState
        content={resolveFilteredEmptyState(activeFilters.map((f) => f.label))}
        onAction={onClear}
      />
    );
  }
  return (
    <SurfaceState
      content={resolveNoCandidatesState({
        activeRoles: signals?.activeRoles ?? 0,
        discoveryStarted: signals?.discoveryStarted ?? false,
        inProcessing: signals?.inProcessing ?? 0,
        runsCompleted: signals?.runsCompleted ?? 0,
      })}
    />
  );
}
