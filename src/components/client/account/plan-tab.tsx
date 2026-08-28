/**
 * One tab that answers "what am I on, what does it cost, and what do I get?"
 * Prices come from the catalogue, which mirrors the public pricing page —
 * there is no second set of numbers anywhere.
 */
import { useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import {
  hasSeatContext,
  seatContextSummary,
  seatShortfall,
  type SeatUpgradeContext,
} from "@/lib/seat-upgrade";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client-context.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { TURNAROUND_LABEL } from "@/config/pricing-core";
import { PlanPanel } from "@/components/client/plan-panel";
import { ServiceExpectationsTable } from "@/components/client/service-expectations-table";
import { PermissionDenied, SkeletonRows } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { areaDeniedMessage, canAccessArea } from "@/lib/collaborator-roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";



export function PlanTab() {
  const ctxFn = useServerFn(getClientContext);
  const orgSearch = useClientOrgSearch();
  const support = useSupportView();

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctxState = useQueryState(ctxQuery);
  const ctx = ctxState.data;
  const isLoading = ctxState.isLoading;

  const orgId = ctx?.active?.organization_id as string | undefined;
  const isAdmin =
    ctx?.active?.role === "client_admin" ||
    ctx?.active?.role === "platform_admin" ||
    ctx?.active?.role === "operations";
  const canMutate = Boolean(isAdmin) && !support.readOnly;
  const canSeeBilling = canAccessArea(ctx?.active?.role as string | undefined, "billing");

  const [requested, setRequested] = useState<string | null>(null);


  // Seat context arrives from a blocked invite or reactivation on the team tab,
  // so the numbers behind the prompt are the same numbers shown here.
  const search = useSearch({ from: "/_authenticated/client/account" });
  const seatCtx: SeatUpgradeContext = {
    ...(search.seatsUsed !== undefined ? { seatsUsed: search.seatsUsed } : {}),
    ...(search.seatLimit !== undefined ? { seatLimit: search.seatLimit } : {}),
    ...(search.seatsPending !== undefined ? { seatsPending: search.seatsPending } : {}),
    ...(search.seatsNeeded !== undefined ? { seatsNeeded: search.seatsNeeded } : {}),
  };
  const showSeatContext = hasSeatContext(seatCtx);
  const shortfall = seatShortfall(seatCtx);





  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Plan and pricing</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          What you're on, what it covers, and what else we offer. Every price here is the price on
          our public pricing page. {TURNAROUND_LABEL} applies to every plan.
        </p>
      </div>

      {showSeatContext && (
        <div
          data-testid="seat-shortfall-banner"
          className="rounded-lg border taas-bd-warning px-4 py-3"
        >
          <p className="text-sm font-medium">
            {shortfall > 0
              ? `You need ${shortfall} more seat${shortfall === 1 ? "" : "s"} than your plan allows`
              : "Seat check for the action you tried"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{seatContextSummary(seatCtx)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Each plan below shows the seats it includes and whether it clears that gap the moment
            it starts. Cancelling a pending invitation frees a seat without changing plan.
          </p>
        </div>
      )}



      {ctxState.isError ? (
        <QueryErrorCard error={ctxState.error} onRetry={ctxState.retry} retrying={ctxState.retrying} />
      ) : isLoading || !orgId ? (
        <SkeletonRows />
      ) : !canSeeBilling ? (
        <PermissionDenied
          title="Plan and billing is Admin-only"
          description={areaDeniedMessage("billing")}
          whoToAsk="Your Admin can share what the plan covers, or change your role."
          action={{ label: "Back to your workspace", to: "/client" }}
        />
      ) : (
        <>
          <PlanPanel
            organizationId={orgId}
            canMutate={canMutate}
            requestedPriceId={requested}
            onRequestHandled={() => setRequested(null)}
          />
          <ServiceExpectationsTable orgId={orgId} />
        </>
      )}


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Not sure which fits?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Talk it through with us before you commit — 30 minutes, no obligation.</span>
          <Button asChild size="sm" variant="outline">
            <Link to="/book-call" search={{ position: undefined }}>Book a call</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
