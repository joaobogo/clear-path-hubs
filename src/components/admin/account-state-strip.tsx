/**
 * Plan · seats · onboarding, printed from the one reader.
 *
 * Reused by the admin client record Overview and the Access tab so the same
 * workspace cannot read "No plan" on one tab and a plan name on another.
 */
import { useQuery } from "@tanstack/react-query";
import { getAccountState } from "@/lib/account-state.functions";
import { planDisplayLabel, NO_PLAN_LABEL, type AccountState } from "@/lib/account-state";
import { Badge } from "@/components/ui/badge";

export function useAccountState(organizationId: string) {
  return useQuery<AccountState>({
    queryKey: ["account-state", organizationId],
    queryFn: () => getAccountState({ data: { organization_id: organizationId } }),
  });
}

export function AccountStateStrip({ organizationId }: { organizationId: string }) {
  const { data, isPending, isError } = useAccountState(organizationId);

  if (isPending) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Reading plan, seats and setup…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Plan, seats and setup are unavailable right now.
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-3">
      <Cell label="Plan">
        <span className="font-medium text-foreground">{planDisplayLabel(data.plan)}</span>
        {data.plan.status ? (
          <Badge variant="outline" className="ml-2 capitalize">
            {data.plan.status.replace(/_/g, " ")}
          </Badge>
        ) : null}
      </Cell>
      <Cell label="Seats">
        <span className="font-medium tabular-nums text-foreground">
          {data.seats.used} / {data.seats.limit}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          owner seat plus {data.seats.recruiterSeats} recruiter seat
          {data.seats.recruiterSeats === 1 ? "" : "s"}
        </span>
      </Cell>
      <Cell label="Setup">
        <span className="font-medium text-foreground">{data.onboarding.label}</span>
      </Cell>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export { NO_PLAN_LABEL };
