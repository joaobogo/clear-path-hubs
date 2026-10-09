import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { ComparePageView, comparePageHead } from "@/components/marketing/compare-page";
import { HUB_PAGE } from "@/content/compare-pages";

export const Route = createFileRoute("/compare/")({
  head: () => comparePageHead(HUB_PAGE),
  component: () => <ComparePageView page={HUB_PAGE} />,
  errorComponent: makeRouteErrorComponent("public", "compare"),
});
