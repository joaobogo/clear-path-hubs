import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { ComparePageView, comparePageHead } from "@/components/marketing/compare-page";
import { AGENCIES_PAGE } from "@/content/compare-pages";

export const Route = createFileRoute("/compare/recruiting-agencies")({
  head: () => comparePageHead(AGENCIES_PAGE),
  component: () => <ComparePageView page={AGENCIES_PAGE} />,
  errorComponent: makeRouteErrorComponent("public", "compare-recruiting-agencies"),
});
