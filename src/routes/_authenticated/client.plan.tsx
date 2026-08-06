/**
 * One page that answers "what am I on, what does it cost, and what do I get?"
 * Prices come from the catalogue, which mirrors the public pricing page —
 * there is no second set of numbers anywhere.
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { PLAN_CATALOGUE } from "@/lib/payments-catalog";
import { TURNAROUND_LABEL } from "@/config/pricing-core";
import { PlanPanel } from "@/components/client/plan-panel";
import { ServiceExpectationsTable } from "@/components/client/service-expectations-table";
import { PermissionDenied, SkeletonRows } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { areaDeniedMessage, canAccessArea } from "@/lib/collaborator-roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/client/plan")({
  head: () => ({
    meta: [
      { title: "Plan and pricing — your subscription | TaaSFlow" },
      {
        name: "description",
        content:
          "See the plan you're on, how many roles it covers, what renews when, and every plan you could move to — one page, one set of numbers.",
      },
      { property: "og:title", content: "Plan and pricing | TaaSFlow" },
      {
        property: "og:description",
        content: "Your plan, your role allowance, and every option — with the same prices as our public pricing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage,
});

function money(amountUsd: number) {
  return `$${amountUsd.toLocaleString("en-US")}`;
}

/**
 * One plan, clickable when the viewer is allowed to buy or switch. The whole
 * card is the control so it works on a phone without hunting for a button.
 */
function PlanCard({
  label,
  price,
  summary,
  detail,
  onSelect,
  actionLabel,
}: {
  label: string;
  price: string;
  summary: string;
  detail: string | null;
  onSelect: (() => void) | null;
  actionLabel: string;
}) {
  const body = (
    <>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          {label}
          <Badge variant="outline">{price}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>{summary}</p>
        {detail ? <p className="text-xs">{detail}</p> : null}
      </CardContent>
    </>
  );

  if (!onSelect) return <Card>{body}</Card>;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${actionLabel} — ${label}, ${price}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="cursor-pointer transition hover:border-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Card>
  );
}


function PlanPage() {
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

  const packages = PLAN_CATALOGUE.filter((p) => p.kind === "package");
  const subscriptions = PLAN_CATALOGUE.filter((p) => p.kind === "subscription");

  const [requested, setRequested] = useState<string | null>(null);
  const canPick = Boolean(orgId) && canSeeBilling && canMutate;
  const pick = (priceId: string) => {
    setRequested(priceId);
    document.getElementById("plan-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Plan and pricing</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          What you're on, what it covers, and what else we offer. Every price here is the price on
          our public pricing page. {TURNAROUND_LABEL} applies to every plan.
        </p>
      </div>

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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">One-off packages</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((plan) => (
            <PlanCard
              key={plan.priceId}
              label={plan.label}
              price={money(plan.amountUsd)}
              summary={plan.summary}
              detail={plan.validForDays ? `Valid ${plan.validForDays} days` : null}
              onSelect={canPick ? () => pick(plan.priceId) : null}
              actionLabel="Buy this package"
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Subscriptions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {subscriptions.map((plan) => (
            <PlanCard
              key={plan.priceId}
              label={plan.label}
              price={`${money(plan.amountUsd)}/${plan.interval === "year" ? "yr" : "mo"}`}
              summary={plan.summary}
              detail="Cancel any time — it runs to the end of the period"
              onSelect={canPick ? () => pick(plan.priceId) : null}
              actionLabel="Switch to this plan"
            />
          ))}
        </div>

      </section>

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
