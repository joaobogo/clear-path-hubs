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
      { title: "Set up your hiring system — TaaSFlow" },
      {
        name: "description",
        content:
          "Configure your workspace, first role, requirements, scoring weights, agent level and oversight gates in one guided sequence.",
      },
      { property: "og:title", content: "Set up your hiring system — TaaSFlow" },
      {
        property: "og:description",
        content:
          "Ten guided steps that configure your hiring system, from workspace to first run.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Set up your hiring system</h1>
        <p className="max-w-2xl text-muted-foreground">
          {ONBOARDING_STEPS.length} steps, {formatMinutes(ONBOARDING_TOTAL_MINUTES)} in total.
          Everything saves as you go, so you can stop at any point and continue later.
        </p>
      </header>
      <OnboardingWizard />
    </div>
  );
}
