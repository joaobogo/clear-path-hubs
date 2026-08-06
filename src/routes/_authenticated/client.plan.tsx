import { createFileRoute } from "@tanstack/react-router";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { PlanTab } from "@/components/client/account/plan-tab";

const RoutePending = makeWorkspacePending({ shape: "rows", kpis: false, width: "5xl" });
export const Route = createFileRoute("/_authenticated/client/plan")({
	pendingMs: 150,
	pendingComponent: RoutePending,
  head: () => ({
    meta: [
      { title: "Plan and pricing — your subscription | TaaSFlow" },
      {
        name: "description",
        content:
          "See the plan you're on, how many roles it covers, what renews when, and every plan you could move to — one page, one set of numbers.",
      },
      { property: "og:title", content: "Plan and pricing | TaaSFlow" },
      {
        property: "og:description",
        content: "Your plan, your role allowance, and every option — with the same prices as our public pricing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanTab,
});
