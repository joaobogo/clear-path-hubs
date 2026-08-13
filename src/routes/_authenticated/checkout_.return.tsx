import { useEffect } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getCheckoutSessionStatus } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { paymentsEnabled } from "@/config/commerce";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checkout_/return")({
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment status | TaaSFlow" },
      {
        name: "description",
        content: "We verify your payment with the provider before confirming your role is live.",
      },
      { property: "og:title", content: "Payment status | TaaSFlow" },
      {
        property: "og:description",
        content: "Verified payment confirmation for your published role.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Temporary redirect until Stripe go-live.
  beforeLoad: () => {
    if (!paymentsEnabled()) {
      throw redirect({ to: "/book-call", search: { position: undefined } });
    }
  },
  component: CheckoutReturnPage,
});

function money(cents: number | null, currency: string | null) {
  if (cents == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency ?? "usd").toUpperCase(),
  }).format(cents / 100);
}

function CheckoutReturnPage() {
  const { session_id: sessionId } = Route.useSearch();
  const navigate = useNavigate();
  const verify = useServerFn(getCheckoutSessionStatus);

  const statusQuery = useQuery({
    queryKey: ["checkout-status", sessionId],
    queryFn: () => verify({ data: { sessionId: sessionId as string, environment: getStripeEnvironment() } }),
    enabled: Boolean(sessionId),
    // Delayed methods settle later — poll instead of claiming success.
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "processing" || state === "open" ? 4000 : false;
    },
  });
  const { data, isLoading } = statusQuery;

  // Confirmed payment: don't make them click. Straight into the workspace.
  useEffect(() => {
    if (data?.state !== "paid") return;
    toast.success("Payment confirmed — welcome to TaaSFlow. Your welcome email is on its way.");
    navigate({ to: "/client", replace: true });
  }, [data?.state, navigate]);



  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-2xl px-6 py-14">
        {!sessionId ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No payment reference found. If you just paid, check your email receipt or your roles
              list.
            </CardContent>
          </Card>
        ) : isLoading && !data ? (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : statusQuery.isError || !data ? (
          <Card>
            <CardContent className="space-y-4 py-10 text-center text-sm text-muted-foreground">
              <p>
                We couldn't check your payment just now. Nothing is lost — your receipt is the
                record, and this page can try again.
              </p>
              <Button variant="outline" onClick={() => void statusQuery.refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : data.state === "paid" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Payment confirmed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border p-4 text-sm">
                <Row label="Role" value={data.positionTitle ?? "Your role"} />
                <Row label="Amount" value={money(data.amountCents, data.currency) ?? "—"} />
                <Row label="Payment reference" value={data.reference} mono />
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <p className="font-medium">Our first commitment to you</p>
                <p className="mt-1 text-muted-foreground">
                  Your first shortlisted candidates land in your workspace within 5 working days.
                  You'll see the promise, the actual and the variance on your dashboard.
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => navigate({ to: "/client" })}>Go to dashboard</Button>
                <Button variant="outline" onClick={() => navigate({ to: "/client/positions" })}>
                  View the role
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : data.state === "processing" || data.state === "open" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-5 w-5 text-muted-foreground" />
                {data.state === "open" ? "Payment not completed yet" : "Confirming your payment"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                {data.state === "open"
                  ? "Checkout was closed before payment completed. Nothing has been charged and your role is still saved as a draft."
                  : "Your bank hasn't confirmed the payment yet. Some payment methods take a little longer. We're checking every few seconds and this page will update on its own."}
              </p>
              <p className="font-mono text-xs">Reference: {data.reference}</p>
              <div className="flex gap-3">
                {data.positionId ? (
                  <Button
                    onClick={() =>
                      navigate({ to: "/checkout", search: { position: data.positionId! } })
                    }
                  >
                    {data.state === "open" ? "Resume checkout" : "Back to checkout"}
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => navigate({ to: "/client/positions" })}>
                  Back to my roles
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : data.state === "expired" || data.state === "failed" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <XCircle className="h-5 w-5 text-destructive" />
                Payment didn't go through
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>{data.message} No card was charged and your role is still saved as a draft.</p>
              <div className="flex gap-3">
                {data.positionId ? (
                  <Button
                    onClick={() =>
                      navigate({ to: "/checkout", search: { position: data.positionId! } })
                    }
                  >
                    Start checkout again
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => navigate({ to: "/client/positions" })}>
                  Back to my roles
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                We couldn't verify this payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>{data.message}</p>
              <p>
                If your card was charged, nothing is lost — send us the reference above and we'll
                sort it the same day.
              </p>
              <Button variant="outline" onClick={() => navigate({ to: "/client/positions" })}>
                Back to my roles
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>{value}</span>
    </div>
  );
}
