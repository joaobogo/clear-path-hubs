import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { MoneyPageView, moneyPageHead } from "@/components/marketing/money-page";
import { RECRUITING_AS_A_SERVICE_PAGE } from "@/content/money-pages";

export const Route = createFileRoute("/recruiting-as-a-service")({
  head: () => moneyPageHead(RECRUITING_AS_A_SERVICE_PAGE),
  component: () => <MoneyPageView page={RECRUITING_AS_A_SERVICE_PAGE} />,
  errorComponent: makeRouteErrorComponent("public", "recruiting-as-a-service"),
});
