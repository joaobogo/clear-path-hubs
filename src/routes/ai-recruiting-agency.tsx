import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { MoneyPageView, moneyPageHead } from "@/components/marketing/money-page";
import { AI_RECRUITING_AGENCY_PAGE } from "@/content/money-pages";

export const Route = createFileRoute("/ai-recruiting-agency")({
  head: () => moneyPageHead(AI_RECRUITING_AGENCY_PAGE),
  component: () => <MoneyPageView page={AI_RECRUITING_AGENCY_PAGE} />,
  errorComponent: makeRouteErrorComponent("public", "ai-recruiting-agency"),
});
