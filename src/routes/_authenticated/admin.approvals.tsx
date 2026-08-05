import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ApprovalsInbox } from "@/components/admin/approvals-inbox";
import { TestRecordsToggle } from "@/components/admin/TestRecordsToggle";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";

const searchSchema = z.object({
  show_test: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  validateSearch: zodValidator(searchSchema),
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
  const { show_test } = Route.useSearch();
  const navigate = Route.useNavigate();

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
        <TestRecordsToggle
          value={show_test}
          onChange={(next) => void navigate({ search: (prev) => ({ ...prev, show_test: next }) })}
        />
      </header>
      <ApprovalsInbox includeTest={show_test} />
    </div>
  );
}
