import { SurfaceState, SurfaceLoading } from "@/components/ds/surface-state";
import {
  resolveFilteredEmptyState,
  resolveNoCandidatesState,
} from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignalsQuery } from "@/hooks/use-empty-state-signals";
import { QueryErrorCard } from "@/components/client/query-error";

export function CandidatesEmptyState({
  workspaceDelivered,
  hasCandidates,
  activeFilters,
  onClear,
  orgId,
  positionId,
}: {
  hasCandidates: boolean;
  activeFilters: { key: string; label: string }[];
  onClear: () => void;
  /**
   * Delivered candidates according to the workspace overview — a DIFFERENT
   * query from the list, so it still answers when the list fails.
   */
  workspaceDelivered?: number;
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

  // The workspace is KNOWN to hold delivered candidates, none are on screen,
  // and no filter explains it. That is a list that did not load — never a
  // verdict about the search.
  //
  // `hasCandidates` is derived from the list query itself, so it is false
  // exactly when the list fails, and every branch below then reasons from
  // signals that loaded fine. A client whose candidate reads were being refused
  // was told "The search finished with nobody qualified · No further searching
  // until the requirements change" on a workspace holding 14 delivered
  // candidates and a confirmed hire — while the caption directly above still
  // read "Adds up to 14 candidates" (audit #8, part 1b).
  //
  // workspaceDelivered comes from the overview KPIs, a different query, so it
  // survives the failure that empties this list.
  if (!filteredOut && (workspaceDelivered ?? 0) > 0) {
    return (
      <QueryErrorCard
        title="We couldn't show your candidates"
        error={
          error ??
          new Error(
            `This workspace has ${workspaceDelivered} delivered ${
              workspaceDelivered === 1 ? "candidate" : "candidates"
            }, but the list did not load. Nothing has been lost.`,
          )
        }
        onRetry={refetch}
        retrying={retrying}
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
        awaitingRelease: signals.awaitingRelease,
        runsCompleted: signals.runsCompleted,
        runsRunning: signals.runsRunning,
        sourcing: signals.sourcing,
      })}
    />
  );
}
