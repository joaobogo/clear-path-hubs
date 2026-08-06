import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsInbox } from "@/components/admin/approvals-inbox";
import { useIncludeTestRecords } from "@/lib/admin-scope";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals · TaaSFlow admin" },
      {
        name: "description",
        content:
          "Every pending client-visible action in one queue: candidate visibility, contact release, shortlist shares and position publishing.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.approvals.tsx",
  ),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  // One admin-wide scope, owned by the layout toggle.
  const includeTest = useIncludeTestRecords();

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Nothing reaches a client without a decision here or in-place. Both routes run the same
            gates and write the same audit trail.
          </p>
        </div>
      </header>
      <ApprovalsInbox includeTest={includeTest} />
    </div>
  );
}
