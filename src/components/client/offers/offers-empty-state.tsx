import { SurfaceState } from "@/components/ds/surface-state";
import { resolveNoOutcomesState } from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignals } from "@/hooks/use-empty-state-signals";

export function OffersEmptyState({ orgId }: { orgId: string }) {
  const signals = useEmptyStateSignals(orgId);
  return (
    <SurfaceState
      content={resolveNoOutcomesState({
        activeRoles: signals?.activeRoles ?? 0,
        interviews: signals?.interviews ?? 0,
        offers: signals?.openOffers ?? 0,
      })}
    />
  );
}
