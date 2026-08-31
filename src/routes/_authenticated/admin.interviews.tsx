import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { getAdminInterviews } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TestScopeEmptyNote } from "@/components/admin/test-records-toggle";
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
  // Dark amber text on light amber — the token pair used everywhere else.
  // The previous combination rendered near-white on light amber and was
  // unreadable (audit #4, L1).
  requested: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  scheduling: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  scheduled: "bg-info/15 text-info",
  completed: "bg-success/15 text-success",
  cancelled: "bg-muted text-muted-foreground",
};

const GROUPS: Array<{
  key: string;
  title: string;
  statuses: string[];
  hint: string;
  /**
   * What an empty group means. Every group carried a real explanation of what
   * it holds, and then rendered a bare "Nothing here." when it held nothing —
   * so "Scheduled · 0" read as reassurance while three interviews sat in
   * "Awaiting a time" (audit #8, TF8-13).
   */
  empty: string;
}> = [
  {
    key: "coordinate",
    title: "Awaiting a time",
    statuses: ["requested", "scheduling"],
    hint: "The client asked to interview — propose or confirm a slot.",
    empty: "No outstanding requests. Nothing is waiting on you here.",
  },
  {
    key: "scheduled",
    title: "Scheduled",
    statuses: ["scheduled"],
    hint: "Confirmed and on the calendar.",
    empty:
      "Nothing is booked. Any interview still waiting on a time is in “Awaiting a time” above.",
  },
  {
    key: "done",
    title: "Recently completed",
    statuses: ["completed"],
    hint: "Held — chase feedback if the scorecard is still missing.",
    empty: "No interviews have been held yet.",
  },
  {
    key: "cancelled",
    title: "Cancelled",
    statuses: ["cancelled"],
    hint: "Called off. Kept on the page so the counts account for every interview.",
    empty: "Nothing has been cancelled.",
  },
];

/** Every status the groups above claim. Anything else still has to be shown. */
const GROUPED_STATUSES = new Set(GROUPS.flatMap((g) => g.statuses));

function InterviewsPage() {
  const fn = useServerFn(getAdminInterviews);
  const query = useQuery({
    queryKey: ["admin-interviews"],
    queryFn: () => fn(),
  });
  const interviews = ((query.data as Any)?.interviews ?? []) as Any[];
  // A status outside the groups below used to disappear from the page with no
  // count admitting it, so the sections never added up to what "every
  // interview" promised (audit #4, L10). Anything ungrouped is listed too.
  const ungrouped = interviews.filter((iv) => !GROUPED_STATUSES.has(String(iv.status)));

  return (
    <div className="max-w-5xl p-6 md:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Interviews</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every interview across all clients, grouped by what needs doing next.
        </p>
        {!query.isLoading && !query.isError && (
          <p className="mt-1 text-sm text-muted-foreground">
            {interviews.length === 0 ? (
              <>
                {/* "No interviews yet." under a header promising "grouped by
                    what needs doing next" left the reader unsure whether this
                    desk was waiting on them (audit #6, A6-29). Clients open
                    interviews; staff coordinate them. Say so, and say when the
                    list is empty only because test records are hidden. */}
                No interviews yet. Clients request these from their shortlist — nothing here is
                waiting on you.
                <TestScopeEmptyNote className="mt-1 text-xs" />
              </>
            ) : (
              `${interviews.length} interview${interviews.length === 1 ? "" : "s"} in total.`
            )}
          </p>
        )}
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
          {[
            ...GROUPS.map((g) => ({
              ...g,
              rows: interviews.filter((iv) => g.statuses.includes(String(iv.status))),
            })),
            ...(ungrouped.length > 0
              ? [
                  {
                    key: "other",
                    title: "Other statuses",
                    hint: "Not in a stage above — shown so no interview is hidden.",
                    // Only built when ungrouped rows exist, so this never
                    // renders — but the shape has to match or the group list
                    // loses its type.
                    empty: "Every interview is in one of the stages above.",
                    rows: ungrouped,
                  },
                ]
              : []),
          ].map((g) => {
            const rows = g.rows;
            return (
              <section key={g.key}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 className="text-sm font-semibold">{g.title}</h2>
                  <span className="text-xs text-muted-foreground">
                    {rows.length} · {g.hint}
                  </span>
                </div>
                {rows.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground">{g.empty}</Card>
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
