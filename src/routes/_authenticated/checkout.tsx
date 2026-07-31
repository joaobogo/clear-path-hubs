import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPositionCheckoutContext } from "@/lib/payments.functions";
import { useAllowanceForPosition } from "@/lib/plans.functions";
import { POSITION_PUBLISH_OFFER } from "@/lib/payments-catalog";
import { PositionCheckout } from "@/components/payments/position-checkout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    position: typeof search.position === "string" ? search.position : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Checkout — publish your role | TaaSFlow" },
      {
        name: "description",
        content:
          "Complete payment to publish your role. Your brief stays saved as a draft until payment clears.",
      },
      { property: "og:title", content: "Checkout — publish your role | TaaSFlow" },
      {
        property: "og:description",
        content: "Pay once to publish a role and start sourcing with TaaSFlow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { position } = Route.useSearch();
  const navigate = useNavigate();
  const loadContext = useServerFn(getPositionCheckoutContext);
  const useAllowanceFn = useServerFn(useAllowanceForPosition);

  const useAllowance = useMutation({
    mutationFn: () => useAllowanceFn({ data: { positionId: position as string } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(
          result.reason === "no_allowance"
            ? "Your plan has no roles left. You can pay for this one or move up a plan."
            : "We couldn't apply your plan to this role. Nothing was charged.",
        );
        return;
      }
      toast.success(
        result.rolesRemaining === null
          ? `Published against ${result.planLabel}.`
          : `Published against ${result.planLabel} — ${result.rolesRemaining} role${result.rolesRemaining === 1 ? "" : "s"} left.`,
      );
      navigate({ to: "/client/positions" });
    },
    onError: () => toast.error("We couldn't apply your plan to this role."),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["checkout-context", position],
    queryFn: () => loadContext({ data: { positionId: position as string } }),
    enabled: Boolean(position),
  });

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`
      : "";

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="order-2 lg:order-1">
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Publish your role</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Your brief is saved as a draft. It stays that way until payment clears — leaving this
            page won't lose anything.
          </p>

          {!position ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No role selected for checkout.
                <div className="mt-4">
                  <Button variant="outline" onClick={() => navigate({ to: "/client/positions" })}>
                    Back to your roles
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <Skeleton className="h-[520px] w-full rounded-xl" />
          ) : !data?.ok ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                We couldn't find that role in your workspace.
              </CardContent>
            </Card>
          ) : ["paid", "exempt", "covered"].includes(String(data.position.paymentStatus)) ? (
            <Card>
              <CardContent className="space-y-4 py-10 text-center">
                <p className="text-sm">This role is already paid for.</p>
                <Button onClick={() => navigate({ to: "/client/positions" })}>
                  Go to your roles
                </Button>
              </CardContent>
            </Card>
          ) : data.allowance ? (
            <Card>
              <CardContent className="space-y-4 py-8">
                <div>
                  <p className="text-sm font-medium">
                    This role is covered by {data.allowance.planLabel}.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.allowance.rolesRemaining === null
                      ? "Your plan covers unlimited roles, so there's nothing to pay."
                      : `You have ${data.allowance.rolesRemaining} role${data.allowance.rolesRemaining === 1 ? "" : "s"} left on your plan. Publishing uses one of them — no card needed.`}
                  </p>
                </div>
                <Button
                  onClick={() => useAllowance.mutate()}
                  disabled={useAllowance.isPending}
                >
                  {useAllowance.isPending ? "Publishing…" : "Publish using my plan"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <PositionCheckout positionId={data.position.id} returnUrl={returnUrl} />
          )}
        </div>

        <aside className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{POSITION_PUBLISH_OFFER.name}</span>
                <Badge variant="secondary">{POSITION_PUBLISH_OFFER.turnaround}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data?.ok ? (
                <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
                  <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{data.position.title}</div>
                    <div className="text-xs text-muted-foreground">Saved as a draft</div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-baseline justify-between border-b pb-3">
                <span className="text-sm text-muted-foreground">Total today</span>
                <span className="text-2xl font-semibold">{POSITION_PUBLISH_OFFER.display}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tax is calculated at checkout based on your billing address.
              </p>

              <ul className="space-y-2 text-sm">
                {POSITION_PUBLISH_OFFER.includes.map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">What happens once payment clears</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {POSITION_PUBLISH_OFFER.nextSteps.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Button
            variant="ghost"
            className="w-full justify-between"
            onClick={() => navigate({ to: "/client/positions" })}
          >
            Pay later — keep it as a draft
            <ArrowRight className="h-4 w-4" />
          </Button>
        </aside>
      </div>
    </div>
  );
}
