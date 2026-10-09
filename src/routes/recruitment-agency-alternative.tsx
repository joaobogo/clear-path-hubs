import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { MoneyPageView, moneyPageHead } from "@/components/marketing/money-page";
import { AGENCY_ALTERNATIVE_PAGE } from "@/content/money-pages";

export const Route = createFileRoute("/recruitment-agency-alternative")({
  head: () => moneyPageHead(AGENCY_ALTERNATIVE_PAGE),
  component: () => <MoneyPageView page={AGENCY_ALTERNATIVE_PAGE} />,
  errorComponent: makeRouteErrorComponent("public", "recruitment-agency-alternative"),
});
