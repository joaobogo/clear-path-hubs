import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { DecisionBacklogPanel } from "@/components/admin/decision-backlog-panel";
import { useIncludeTestRecords } from "@/lib/admin-scope";

export const Route = createFileRoute("/_authenticated/admin/decision-backlog")({
  head: () => ({
    meta: [
      { title: "Decision backlog · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DecisionBacklogPage,
  errorComponent: makeRouteErrorComponent("admin", "_authenticated/admin.decision-backlog"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

function DecisionBacklogPage() {
  const showTest = useIncludeTestRecords();
  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Client decisions backlog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Candidates shared with clients but awaiting a final decision. Every row opens the evidence record.
        </p>
      </header>

      <DecisionBacklogPanel includeTest={showTest} showClientColumn />
    </div>
  );
}
