import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSlaBreaches } from "@/lib/admin-sla-breach.functions";
import { SlaBreachPanel } from "@/components/admin/sla-breach-panel";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { useIncludeTestRecords } from "@/lib/admin-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/sla")({
  head: () => ({
    meta: [
      { title: "SLA breaches · TaaSFlow admin" },
      {
        name: "description",
        content: "Service commitments that are past target right now, with owner and days over.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.sla.tsx"),
  component: SlaBreachPage,
});

const DEFINITIONS = [
  {
    title: "First shortlist",
    body: "Target is the committed number of days from the role baseline to the first client-visible candidate. Breached when that many days have passed with no client-visible candidate, or the first one landed later than target.",
  },
  {
    title: "Shortlist size",
    body: "Target is the committed number of client-visible candidates by the same day-count deadline. Breached when the deadline has passed and fewer candidates are visible to the client.",
  },
  {
    title: "Interview slots",
    body: "Target is the committed hours from an interview request to slots being offered or a time being booked. Breached when the oldest request is past that window, whether or not slots eventually went out.",
  },
];

function SlaBreachPage() {
  const show_test = useIncludeTestRecords();
  const queryKey = ["admin-sla-breaches", show_test] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getSlaBreaches({ data: { include_test: show_test } }),
  });

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">SLA breaches</h1>
          <p className="text-sm text-muted-foreground">
            Commitments where the actual has already passed the target, worst first.
          </p>
          <p className="text-xs text-muted-foreground">
            {show_test
              ? "Including test and internal organizations."
              : "Test and internal organizations are hidden."}
          </p>
        </div>
      </header>

      <SlaBreachPanel
        data={query.data}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        queryKey={queryKey}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Commitment definitions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {DEFINITIONS.map((d) => (
            <div key={d.title} className="space-y-1">
              <p className="text-sm font-medium">{d.title}</p>
              <p className="text-xs text-muted-foreground">{d.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
