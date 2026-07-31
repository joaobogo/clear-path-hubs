/**
 * One page that answers "what am I on, what does it cost, and what do I get?"
 * Prices come from the catalogue, which mirrors the public pricing page —
 * there is no second set of numbers anywhere.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { PLAN_CATALOGUE } from "@/lib/payments-catalog";
import { TURNAROUND_LABEL } from "@/config/pricing-core";
import { PlanPanel } from "@/components/client/plan-panel";
import { SkeletonRows } from "@/components/client/states";
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

function PlanPage() {
  const ctxFn = useServerFn(getClientContext);
  const orgSearch = useClientOrgSearch();
  const support = useSupportView();

  const { data: ctx, isLoading } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });

  const orgId = ctx?.active?.organization_id as string | undefined;
  const isAdmin =
    ctx?.active?.role === "client_admin" ||
    ctx?.active?.role === "platform_admin" ||
    ctx?.active?.role === "operations";
  const canMutate = Boolean(isAdmin) && !support.readOnly;

  const packages = PLAN_CATALOGUE.filter((p) => p.kind === "package");
  const subscriptions = PLAN_CATALOGUE.filter((p) => p.kind === "subscription");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Plan and pricing</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          What you're on, what it covers, and what else we offer. Every price here is the price on
          our public pricing page. {TURNAROUND_LABEL} applies to every plan.
        </p>
      </div>

      {isLoading || !orgId ? <SkeletonRows /> : <PlanPanel organizationId={orgId} canMutate={canMutate} />}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">One-off packages</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((plan) => (
            <Card key={plan.priceId}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  {plan.label}
                  <Badge variant="outline">{money(plan.amountUsd)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{plan.summary}</p>
                <p>
                  {plan.rolesTotal === null
                    ? "Unlimited roles"
                    : `${plan.rolesTotal} role${plan.rolesTotal === 1 ? "" : "s"}`}
                  {plan.validForDays ? ` · valid ${plan.validForDays} days` : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Subscriptions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {subscriptions.map((plan) => (
            <Card key={plan.priceId}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  {plan.label}
                  <Badge variant="outline">
                    {money(plan.amountUsd)}/{plan.interval === "year" ? "yr" : "mo"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{plan.summary}</p>
                <p>
                  {plan.rolesTotal === null
                    ? "Unlimited active roles"
                    : `Up to ${plan.rolesTotal} active roles`}{" "}
                  · cancel any time, runs to the end of the period
                </p>
              </CardContent>
            </Card>
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
            <Link to="/book-call">Book a call</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
