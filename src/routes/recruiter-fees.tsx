import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { ComparePageView, comparePageHead } from "@/components/marketing/compare-page";
import { FEES_PAGE } from "@/content/compare-pages";

export const Route = createFileRoute("/recruiter-fees")({
  head: () => comparePageHead(FEES_PAGE),
  component: () => <ComparePageView page={FEES_PAGE} />,
  errorComponent: makeRouteErrorComponent("public", "recruiter-fees"),
});
