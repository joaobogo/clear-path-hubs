/**
 * Plan and role allowance, on the account page.
 *
 * Shows what the client is on, how much of it is left, and lets an admin buy,
 * change or cancel — with the consequence spelled out before they click.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import {
  getPlanState,
  listPlans,
  createPlanCheckoutSession,
  changePlan,
  cancelPlan,
  resumePlan,
} from "@/lib/plans.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SkeletonRows } from "@/components/client/states";
import { AlertTriangle, Check, CreditCard } from "lucide-react";

function fmtDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function money(amountUsd: number) {
  return `$${amountUsd.toLocaleString("en-US")}`;
}

function PlanCheckout({
  priceId,
  organizationId,
  returnUrl,
}: {
  priceId: string;
  organizationId: string;
  returnUrl: string;
}) {
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const result = await createPlanCheckoutSession({
      data: { priceId, organizationId, returnUrl, environment: getStripeEnvironment() },
    });
    if ("error" in result) {
      setError(result.error);
      throw new Error(result.error);
    }
    if (!result.clientSecret) {
      const message = "Checkout could not be started. No card was charged.";
      setError(message);
      throw new Error(message);
    }
    setError(null);
    return result.clientSecret;
  }, [priceId, organizationId, returnUrl]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>We couldn't open checkout</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{error}</p>
          <p className="text-sm">Nothing was charged and your plan is unchanged.</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div id="plan-checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

export function PlanPanel({
  organizationId,
  canMutate,
  requestedPriceId = null,
  onRequestHandled,
}: {
  organizationId: string;
  canMutate: boolean;
  /** A plan the client picked elsewhere on the page — buy or switch to it. */
  requestedPriceId?: string | null;
  onRequestHandled?: () => void;
}) {
  const queryClient = useQueryClient();
  const planStateFn = useServerFn(getPlanState);
  const plansFn = useServerFn(listPlans);
  const changeFn = useServerFn(changePlan);
  const cancelFn = useServerFn(cancelPlan);
  const resumeFn = useServerFn(resumePlan);

  const [buying, setBuying] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const state = useQuery({
    queryKey: ["plan-state", organizationId],
    queryFn: () => planStateFn({ data: { organizationId } }),
    placeholderData: (prev) => prev,
  });
  const plans = useQuery({ queryKey: ["plan-catalogue"], queryFn: () => plansFn() });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["plan-state", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["client-account", organizationId] });
  };

  const change = useMutation({
    mutationFn: (priceId: string) =>
      changeFn({ data: { organizationId, priceId, environment: getStripeEnvironment() } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.effect === "immediate"
          ? `You're on ${result.label} now. The difference is pro-rated on your next invoice.`
          : `${result.label} starts on ${fmtDate(result.effectiveAt)}. Nothing changes before then.`,
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { organizationId, environment: getStripeEnvironment() } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.accessUntil
          ? `Cancelled. You keep full access until ${fmtDate(result.accessUntil)}.`
          : "Cancelled. You keep access until the end of this paid period.",
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resume = useMutation({
    mutationFn: () => resumeFn({ data: { organizationId, environment: getStripeEnvironment() } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.");
        return;
      }
      toast.success("Your plan will keep running.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sub = state.data?.subscription ?? null;
  const allowance = state.data?.allowance ?? null;
  const catalogue = plans.data ?? [];
  const subscriptions = catalogue.filter((p) => p.kind === "subscription");
  const packages = catalogue.filter((p) => p.kind === "package");
  const currentTier = subscriptions.find((p) => p.priceId === sub?.priceId)?.tier ?? 0;

  const returnUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

  // A plan chosen from the catalogue further down the page routes through the
  // same buy / change path as the buttons in here — one code path, one result.
  useEffect(() => {
    if (!requestedPriceId) return;
    const plan = catalogue.find((p) => p.priceId === requestedPriceId);
    onRequestHandled?.();
    if (!plan) return;
    if (!canMutate) {
      toast.error("Only an Admin on this workspace can change the plan.");
      return;
    }
    if (plan.priceId === sub?.priceId) {
      toast.info("You're already on this plan.");
      return;
    }
    setShowAll(true);
    if (plan.kind === "subscription" && sub) {
      change.mutate(plan.priceId);
      return;
    }
    setBuying(plan.priceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPriceId, catalogue.length, canMutate, sub?.priceId]);


  return (
    <section id="plan-panel" className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Plan and role allowance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What you're on, what's left to use, and what happens if you change it.
          </p>
        </div>
        {sub && (
          <Badge variant={sub.cancelAtPeriodEnd ? "outline" : "secondary"}>
            {sub.cancelAtPeriodEnd ? "Ends at period close" : sub.status}
          </Badge>
        )}
      </div>

      {state.isLoading && !state.data ? (
        <div className="mt-4">
          <SkeletonRows rows={2} />
        </div>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Current plan</div>
            <div className="mt-1 text-sm font-medium">
              {sub?.label ?? (allowance?.source === "package" ? allowance.label : "Pay per role")}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Roles left to open</div>
            <div className="mt-1 text-sm font-medium">
              {!allowance
                ? "None held — each role is paid for on publish"
                : allowance.rolesRemaining === null
                  ? "Unlimited"
                  : `${allowance.rolesRemaining} of ${allowance.rolesTotal}`}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              {sub ? (sub.cancelAtPeriodEnd ? "Access until" : "Renews") : "Allowance valid until"}
            </div>
            <div className="mt-1 text-sm font-medium">
              {fmtDate(sub?.currentPeriodEnd ?? allowance?.expiresAt) ?? "—"}
            </div>
          </div>
        </div>
      )}

      {sub?.pendingPriceId && (
        <div className="mt-4 rounded-lg border taas-bd-info px-3 py-2 text-sm">
          {sub.pendingLabel} starts on {fmtDate(sub.pendingEffectiveAt)}. Until then you keep
          everything on {sub.label}.
        </div>
      )}

      {sub?.cancelAtPeriodEnd && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border taas-bd-warning px-3 py-2 text-sm">
          <span>
            Your plan ends on {fmtDate(sub.currentPeriodEnd)}. Live roles are paused after that
            date — candidates already in process stay in your account.
          </span>
          {canMutate && (
            <Button size="sm" variant="outline" onClick={() => resume.mutate()} disabled={resume.isPending}>
              Keep my plan
            </Button>
          )}
        </div>
      )}

      {canMutate && (
        <div className="mt-5 space-y-4 border-t pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              {sub ? "Change plan" : "Buy a plan"}
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Hide options" : "See options"}
            </Button>
          </div>

          {showAll && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Monthly and annual plans
                </div>
                <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                  {subscriptions.map((plan) => {
                    const isCurrent = plan.priceId === sub?.priceId;
                    const isUpgrade = plan.tier > currentTier;
                    return (
                      <li key={plan.priceId} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">{plan.label}</div>
                            <div className="text-xs text-muted-foreground">{plan.summary}</div>
                          </div>
                          {isCurrent && (
                            <Badge variant="secondary" className="shrink-0">
                              <Check className="mr-1 h-3 w-3" /> Current
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 text-sm">
                          {money(plan.amountUsd)}
                          <span className="text-muted-foreground">
                            {plan.interval === "year" ? " / year" : " / month"}
                          </span>
                        </div>
                        {!isCurrent && (
                          <Button
                            size="sm"
                            variant={isUpgrade ? "default" : "outline"}
                            className="mt-3 w-full"
                            disabled={change.isPending}
                            onClick={() =>
                              sub ? change.mutate(plan.priceId) : setBuying(plan.priceId)
                            }
                          >
                            {!sub
                              ? "Start this plan"
                              : isUpgrade
                                ? "Move up now"
                                : "Move down at renewal"}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Moving up takes effect straight away and is pro-rated. Moving down waits for
                  your renewal date so you don't lose roles mid-search.
                </p>
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  One-off packages
                </div>
                <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                  {packages.map((plan) => (
                    <li key={plan.priceId} className="rounded-lg border p-4">
                      <div className="text-sm font-medium">{plan.label}</div>
                      <div className="text-xs text-muted-foreground">{plan.summary}</div>
                      <div className="mt-2 text-sm">{money(plan.amountUsd)}</div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => setBuying(plan.priceId)}
                      >
                        Buy
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              {sub && !sub.cancelAtPeriodEnd && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    Cancelling keeps your access until {fmtDate(sub.currentPeriodEnd) ?? "the end of the paid period"}.
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancel.mutate()}
                    disabled={cancel.isPending}
                  >
                    Cancel plan
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <CreditCard className="h-3.5 w-3.5" />
        Card details are handled by our payment provider. We never see or store them.
      </p>

      <Dialog open={Boolean(buying)} onOpenChange={(open) => !open && setBuying(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Complete your purchase</DialogTitle>
            <DialogDescription>
              Your allowance is added as soon as the payment clears, and we start on your brief
              the same working day.
            </DialogDescription>
          </DialogHeader>
          {buying && (
            <PlanCheckout
              priceId={buying}
              organizationId={organizationId}
              returnUrl={returnUrl}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
