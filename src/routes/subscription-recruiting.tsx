import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { MoneyPageView, moneyPageHead } from "@/components/marketing/money-page";
import { SUBSCRIPTION_PAGE } from "@/content/money-pages";

export const Route = createFileRoute("/subscription-recruiting")({
  head: () => moneyPageHead(SUBSCRIPTION_PAGE),
  component: () => <MoneyPageView page={SUBSCRIPTION_PAGE} />,
  errorComponent: makeRouteErrorComponent("public", "subscription-recruiting"),
});
