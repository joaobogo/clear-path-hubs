import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { getAdminInterviews } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format/datetime";

/**
 * The admin interviews desk (audit A-09). This route used to 301 to the
 * decision backlog, so the overview's "Interviews to coordinate" rows linked
 * to a page about something else. The three "awaiting slot" items now have a
 * home: one list, grouped by what the coordinator has to do next.
 */
export const Route = createFileRoute("/_authenticated/admin/interviews")({
  head: () => ({
    meta: [
      { title: "Interviews · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.interviews.tsx"),
  component: InterviewsPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const STATUS_TONE: Record<string, string> = {
  requested: "taas-bg-warning-soft taas-tx-warning",
  scheduling: "taas-bg-warning-soft taas-tx-warning",
  scheduled: "bg-info/15 text-info",
  completed: "bg-success/15 text-success",
  cancelled: "bg-muted text-muted-foreground",
};

const GROUPS: Array<{ key: string; title: string; statuses: string[]; hint: string }> = [
  {
    key: "coordinate",
    title: "Awaiting a time",
    statuses: ["requested", "scheduling"],
    hint: "The client asked to interview — propose or confirm a slot.",
  },
  {
    key: "scheduled",
    title: "Scheduled",
    statuses: ["scheduled"],
    hint: "Confirmed and on the calendar.",
  },
  {
    key: "done",
    title: "Recently completed",
    statuses: ["completed"],
    hint: "Held — chase feedback if the scorecard is still missing.",
  },
];

function InterviewsPage() {
  const fn = useServerFn(getAdminInterviews);
  const query = useQuery({
    queryKey: ["admin-interviews"],
    queryFn: () => fn(),
  });
  const interviews = ((query.data as Any)?.interviews ?? []) as Any[];

  return (
    <div className="max-w-5xl p-6 md:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Interviews</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every interview across all clients, grouped by what needs doing next.
        </p>
      </header>

      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : query.isError ? (
        <Card className="p-6">
          <p className="text-sm font-medium">We couldn't load interviews.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {(query.error as Error)?.message ?? "Unknown error"}
          </p>
          <button
            type="button"
            className="mt-3 text-sm text-primary hover:underline"
            onClick={() => query.refetch()}
          >
            Try again
          </button>
        </Card>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((g) => {
            const rows = interviews.filter((iv) => g.statuses.includes(String(iv.status)));
            return (
              <section key={g.key}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 className="text-sm font-semibold">{g.title}</h2>
                  <span className="text-xs text-muted-foreground">
                    {rows.length} · {g.hint}
                  </span>
                </div>
                {rows.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground">Nothing here.</Card>
                ) : (
                  <div className="space-y-2">
                    {rows.map((iv) => {
                      const m = iv.candidate_matches;
                      return (
                        <Card key={iv.id} className="flex flex-wrap items-center gap-3 p-3">
                          <Badge className={STATUS_TONE[String(iv.status)] ?? "bg-muted"}>
                            {String(iv.status).replace(/_/g, " ")}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <Link
                              to="/admin/candidates/$id"
                              params={{ id: String(iv.candidate_match_id) }}
                              className="text-sm font-medium hover:underline"
                            >
                              {m?.candidate_profiles?.full_name ?? "Candidate"}
                            </Link>
                            <div className="truncate text-xs text-muted-foreground">
                              {m?.positions?.title ?? "—"} · {m?.positions?.organizations?.name ?? "—"}
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            {iv.scheduled_at
                              ? `Scheduled ${formatDateTime(iv.scheduled_at)}`
                              : iv.requested_at
                                ? `Requested ${formatDateTime(iv.requested_at)}`
                                : ""}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
