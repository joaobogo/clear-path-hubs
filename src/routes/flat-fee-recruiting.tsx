import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { MoneyPageView, moneyPageHead } from "@/components/marketing/money-page";
import { FLAT_FEE_PAGE } from "@/content/money-pages";

export const Route = createFileRoute("/flat-fee-recruiting")({
  head: () => moneyPageHead(FLAT_FEE_PAGE),
  component: () => <MoneyPageView page={FLAT_FEE_PAGE} />,
  errorComponent: makeRouteErrorComponent("public", "flat-fee-recruiting"),
});
