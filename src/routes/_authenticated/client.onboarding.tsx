import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOnboardingState } from "@/lib/onboarding.functions";
import { deriveOnboardingState } from "@/lib/account-state";
import { createFileRoute } from "@tanstack/react-router";
import { OnboardingWizard } from "@/components/client/onboarding/onboarding-wizard";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_MINUTES,
  formatMinutes,
} from "@/lib/onboarding/onboarding-steps";

export const Route = createFileRoute("/_authenticated/client/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up · Client workspace" },
      {
        name: "description",
        content:
          "Configure your workspace, first role, requirements, scoring weights, agent level and oversight gates in one guided sequence.",
      },
      { property: "og:title", content: "Set up your hiring system — TaaSFlow" },
      {
        property: "og:description",
        content:
          "Ten guided steps that configure your hiring system, from workspace to first search.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.onboarding.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  component: OnboardingPage,
});

function OnboardingPage() {
  // Same query the wizard runs — react-query dedupes it — read through the same
  // derivation the ADMIN client record uses.
  //
  // Northwind's admin record said "Setup complete" while this page told the
  // client "Step 2 of 10 · about 29 min left", on a workspace with an active
  // role, 14 candidates, two offers and a confirmed hire. A client who has
  // already hired somebody should not be told they are 20% through onboarding
  // (audit 1 Sep, F38).
  const fetchState = useServerFn(getOnboardingState);
  const { data } = useQuery({
    queryKey: ["onboarding-state", null],
    queryFn: () => fetchState({ data: {} }),
    staleTime: 10_000,
  });
  const derived = deriveOnboardingState({
    storedStatus: data?.workspace?.onboarding_status ?? null,
    stepsComplete: data?.complete?.length ?? 0,
    stepsTotal: ONBOARDING_STEPS.length,
  });
  const live = derived.status === "live";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {live ? "Your hiring system is set up" : "Set up your hiring system"}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {live ? (
            <>
              Your workspace is live and running. Anything below that is not ticked is optional —
              it sharpens what we send you, but nothing is waiting on it.
            </>
          ) : (
            <>
              {ONBOARDING_STEPS.length} steps, {formatMinutes(ONBOARDING_TOTAL_MINUTES)} in total.
              Everything saves as you go, so you can stop at any point and continue later.
            </>
          )}
        </p>
      </header>
      <OnboardingWizard />
    </div>
  );
}
