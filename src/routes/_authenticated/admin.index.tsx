import { createFileRoute, Link } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ActivityFeed, ACTIVITY_QUERY_KEY } from "@/components/activity/ActivityFeed";
import { getAdminWorkQueues } from "@/lib/admin-ops.functions";
import { useIncludeTestRecords } from "@/lib/admin-scope";
import { PortfolioHealthTable } from "@/components/admin/portfolio-health-table";
import { DecisionBacklogPanel } from "@/components/admin/decision-backlog-panel";
import { OfferHireRollupPanel } from "@/components/admin/offer-hire-panel";
import { SlaBreachStrip } from "@/components/admin/sla-breach-strip";
import { WorkQueueRow } from "@/components/admin/work-queue-row";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Briefcase,
  ClipboardCheck,
  Clock,
  CalendarClock,
  AlertOctagon,
  RefreshCw,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import type { ComponentType } from "react";

export const WORK_QUEUES_KEY = ["admin", "work-queues"] as const;

export const Route = createFileRoute("/_authenticated/admin/")({
  // The layout resolved the scope in beforeLoad, so the prefetch primes exactly
  // the key the component subscribes to.
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: [...WORK_QUEUES_KEY, context.testScope.includeTest],
      queryFn: () =>
        getAdminWorkQueues({ data: { include_test: context.testScope.includeTest } }),
    }),
  head: () => ({
    meta: [
      { title: "Work queue · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Overview,
  errorComponent: makeRouteErrorComponent("admin", "_authenticated/admin.index"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  intakes_aging: Inbox,
  unpaid: CreditCard,
  setup: Briefcase,
  review: ClipboardCheck,
  client_overdue: Clock,
  interviews: CalendarClock,
  blocked: AlertOctagon,
};

function Overview() {
  const qc = useQueryClient();
  const router = useRouter();
  // Test scope is a per-user preference owned by the admin layout toggle, not a
  // URL flag, so every desk inherits the same view.
  const showTest = useIncludeTestRecords();

  const { data, isFetching } = useSuspenseQuery({
    // Scope belongs in the key so the counts here always match the desk each
    // row links to.
    queryKey: [...WORK_QUEUES_KEY, showTest],
    queryFn: () => getAdminWorkQueues({ data: { include_test: showTest } }),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const queues = data.queues;
  const total = queues.reduce((n, q) => n + q.count, 0);
  // An empty day should look empty: only queues with work render a section.
  const active = queues.filter((q) => q.items.length > 0);

  async function refreshAll() {
    // Every admin panel keys under ["admin", ...]; the feed is the one exception.
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin"] }),
      qc.invalidateQueries({ queryKey: ACTIVITY_QUERY_KEY }),
    ]);
    await router.invalidate();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0
              ? "Nothing is waiting on the platform team right now."
              : `${total} item${total === 1 ? "" : "s"} waiting on you. Every row opens the one action it needs.`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {showTest
              ? "Including test and internal organizations."
              : "Test and internal organizations are hidden."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => void refreshAll()}
          disabled={isFetching}
          aria-label="Refresh work queue"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <SlaBreachStrip includeTest={showTest} />

      {/* Portfolio health first: which accounts are in trouble, not totals. */}
      <PortfolioHealthTable includeTest={showTest} />


      <DecisionBacklogPanel includeTest={showTest} showClientColumn />

      <OfferHireRollupPanel />

      {/* Counts strip — each jumps to its queue below. */}
      <nav aria-label="Queue counts" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {queues.map((q) => {
          const Icon = ICONS[q.key] ?? ClipboardCheck;
          return (
            <a
              key={q.key}
              href={`#queue-${q.key}`}
              className="rounded-lg border bg-card px-3 py-2.5 transition-colors hover:border-primary/50"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{q.label}</span>
              </div>
              <div
                className={`mt-1 text-2xl font-semibold tabular-nums ${
                  q.count === 0 ? "text-muted-foreground/50" : ""
                }`}
              >
                {q.count}
              </div>
            </a>
          );
        })}
      </nav>

      {active.length === 0 ? (
        <section className="rounded-lg border bg-card px-4 py-10 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-success" />
          <h2 className="mt-3 text-sm font-semibold">Every queue is clear</h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            No intake, payment, review, decision, interview or processing item is
            waiting on the platform team.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {active.map((q) => {
            const Icon = ICONS[q.key] ?? ClipboardCheck;
            return (
              <section
                key={q.key}
                id={`queue-${q.key}`}
                className="scroll-mt-20 rounded-lg border bg-card"
              >
                <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <h2 className="text-sm font-semibold">
                        {q.label}{" "}
                        <span className="ml-1 tabular-nums text-muted-foreground">{q.count}</span>
                      </h2>
                      <p className="text-xs text-muted-foreground">{q.description}</p>
                    </div>
                  </div>
                  {q.see_all && q.count > q.items.length ? (
                    <Link
                      to={q.see_all.to}
                      className="shrink-0 whitespace-nowrap text-xs font-medium text-primary hover:underline"
                    >
                      See all {q.count}
                    </Link>
                  ) : null}
                </header>

                <ul className="divide-y">
                  {q.items.map((it) => (
                    <WorkQueueRow key={it.id} item={it} />
                  ))}
                </ul>

                <footer className="border-t px-4 py-2 text-[11px] text-muted-foreground">
                  {q.action_hint}
                </footer>
              </section>
            );
          })}
        </div>
      )}

      {/* Capped: the overview shows the latest 25 events, the full log lives on
          the operations desk. */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Latest activity
          </h2>
          <Link to="/admin/operations" className="text-xs font-medium text-primary hover:underline">
            View all activity
          </Link>
        </div>
        <ScrollArea className="h-[26rem] rounded-xl border bg-card">
          <ActivityFeed limit={25} className="border-0" title="Last 25 events" />
        </ScrollArea>
      </section>
    </div>
  );
}
