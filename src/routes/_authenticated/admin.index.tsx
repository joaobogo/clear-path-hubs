import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ActivityFeed, ACTIVITY_QUERY_KEY } from "@/components/activity/ActivityFeed";
import { getAdminWorkQueues } from "@/lib/admin-ops.functions";
import { ApprovalsInbox } from "@/components/admin/approvals-inbox";
import { useIncludeTestRecords } from "@/lib/admin-scope";
import { PortfolioHealthTable } from "@/components/admin/portfolio-health-table";
import { DecisionBacklogPanel } from "@/components/admin/decision-backlog-panel";
import { OfferHireRollupPanel } from "@/components/admin/offer-hire-panel";
import { SlaBreachStrip } from "@/components/admin/sla-breach-strip";
import { WorkQueueRow } from "@/components/admin/work-queue-row";
import { AdminWidgetErrorBoundary } from "@/components/admin/admin-widget-error-boundary";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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

/** Work queue scope: the whole desk, or only rows the acting admin owns. */
export type QueueScope = "all" | "mine";

export const Route = createFileRoute("/_authenticated/admin/")({
  validateSearch: (raw: Record<string, unknown>): { scope?: QueueScope } =>
    raw["scope"] === "mine" ? { scope: "mine" } : {},
  pendingComponent: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  ),

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
  delivery_failures: AlertOctagon,
  score_stale: RefreshCw,
};

function Header({
  total,
  isReady,
  isFetching,
  showTest,
  onRefresh,
  scope,
}: {
  total: number | null;
  isReady: boolean;
  isFetching: boolean;
  showTest: boolean;
  onRefresh: () => void;
  scope: QueueScope;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Work queue</h1>
        <p className="mt-1 h-5 text-sm text-muted-foreground">
          {total === null ? (
            <span className="inline-block h-4 w-48 animate-pulse rounded bg-muted" />
          ) : total === 0 ? (
            scope === "mine"
              ? "Nothing you own is waiting right now."
              : "Nothing is waiting on the platform team right now."
          ) : (
            `${total} item${total === 1 ? "" : "s"} waiting on ${scope === "mine" ? "you" : "the team"}. Every row opens the one action it needs.`
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {showTest
            ? "Including test and internal organizations."
            : "Test and internal organizations are hidden."}
        </p>
      </div>
      <div className="flex items-center gap-2">
      <div role="group" aria-label="Queue scope" className="flex rounded-md border p-0.5">
        {(["all", "mine"] as QueueScope[]).map((s) => (
          <Link
            key={s}
            to="/admin"
            search={s === "mine" ? { scope: "mine" } : {}}
            replace
            aria-current={scope === s ? "true" : undefined}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              scope === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "All" : "Mine"}
          </Link>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs"
        onClick={() => void onRefresh()}
        disabled={isFetching}
        aria-label="Refresh work queue"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        Refresh
      </Button>
      </div>
    </header>
  );
}

function Overview() {
  const qc = useQueryClient();
  const router = useRouter();
  const showTest = useIncludeTestRecords();
  const { scope = "all" } = Route.useSearch();

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin"] }),
      qc.invalidateQueries({ queryKey: ACTIVITY_QUERY_KEY }),
      qc.invalidateQueries({ queryKey: ["admin-portfolio-health"] }),
      qc.invalidateQueries({ queryKey: ["admin", "decision-backlog"] }),
      qc.invalidateQueries({ queryKey: ["offer-hire-rollup"] }),
      qc.invalidateQueries({ queryKey: ["admin", "sla-breaches"] }),
    ]);
    await router.invalidate();
  }

  return (
    <div className="space-y-6">
      <AdminWidgetErrorBoundary label="Work queue summary">
        <WorkQueueSummary showTest={showTest} onRefresh={refreshAll} scope={scope} />
      </AdminWidgetErrorBoundary>

      <AdminWidgetErrorBoundary label="SLA banner">
        <SlaBreachStrip includeTest={showTest} />
      </AdminWidgetErrorBoundary>

      <AdminWidgetErrorBoundary label="Portfolio health">
        <PortfolioHealthTable includeTest={showTest} />
      </AdminWidgetErrorBoundary>

      <AdminWidgetErrorBoundary label="Awaiting client decision">
        <DecisionBacklogPanel includeTest={showTest} showClientColumn limit={8} />
      </AdminWidgetErrorBoundary>

      <AdminWidgetErrorBoundary label="Offers and hires">
        <OfferHireRollupPanel />
      </AdminWidgetErrorBoundary>

      <AdminWidgetErrorBoundary label="Latest activity">
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
      </AdminWidgetErrorBoundary>
    </div>
  );
}


/** The acting admin's user id, for the "Mine" scope. Presentation-only read. */
function useActingUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUserId(data.user?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);
  return userId;
}

function WorkQueueSummary({
  showTest,
  onRefresh,
  scope,
}: {
  showTest: boolean;
  onRefresh: () => void;
  scope: QueueScope;
}) {
  const actingUserId = useActingUserId();
  const { data, isPending, isFetching, error } = useQuery({
    queryKey: [...WORK_QUEUES_KEY, showTest],
    queryFn: () => getAdminWorkQueues({ data: { include_test: showTest } }),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const allQueues = data?.queues ?? [];
  // "Mine" is a pure client-side filter over the same rows the desk already
  // loaded: owner ids come straight from the loader, so All arithmetic is
  // untouched and Mine always reconciles with it.
  const queues =
    scope === "mine"
      ? allQueues.map((q) => {
          const items = q.items.filter((it) => it.owner?.user_id === actingUserId);
          return { ...q, items, count: items.length };
        })
      : allQueues;
  const total = isPending ? null : queues.reduce((n, q) => n + (typeof q.count === "number" ? q.count : 0), 0);
  const active = queues.filter((q) => q.items.length > 0);
  const isReady = !isPending && !error;

  return (
    <div className="space-y-6">
      <Header total={total} isReady={isReady} isFetching={isFetching} showTest={showTest} onRefresh={onRefresh} scope={scope} />

      {isPending ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Work queue could not load</p>
          <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        </div>
      ) : (
        <>
          <nav aria-label="Queue counts" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
            {queues.map((q) => {
              const Icon = ICONS[q.key] ?? ClipboardCheck;
              const hasItems = (q.count ?? 0) > 0;
              return (
                <a
                  key={q.key}
                  href={hasItems ? `#queue-${q.key}` : undefined}
                  className={cn(
                    "rounded-lg border bg-card px-3 py-2.5 transition-colors",
                    hasItems ? "hover:border-primary/50" : "opacity-50 cursor-not-allowed"
                  )}
                  onClick={(e) => {
                    if (!hasItems) e.preventDefault();
                  }}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{q.label}</span>
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-2xl font-semibold tabular-nums",
                      q.count === 0 ? "text-muted-foreground" : ""
                    )}
                  >
                    {typeof q.count === "number" ? q.count : "—"}
                  </div>
                </a>
              );
            })}
          </nav>

          {active.length === 0 ? (
            <section className="rounded-lg border bg-card px-4 py-10 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-success" />
              <h2 className="mt-3 text-sm font-semibold">
                {scope === "mine" ? "Nothing needs you right now" : "Every queue is clear"}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                {scope === "mine" ? (
                  <>
                    No item on this desk lists you as owner. The rest of the desk is still
                    waiting —{" "}
                    <Link to="/admin" search={{}} replace className="font-medium text-primary hover:underline">
                      switch to All
                    </Link>{" "}
                    to see it.
                  </>
                ) : (
                  "No intake, payment, review, decision, interview or processing item is waiting on the platform team."
                )}
              </p>
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {active.map((q) => (
                <AdminWidgetErrorBoundary key={q.key} label={q.label}>
                  <QueueSection q={q} />
                </AdminWidgetErrorBoundary>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QueueSection({ q }: { q: any }) {
  const Icon = ICONS[q.key] ?? ClipboardCheck;
  return (
    <section id={`queue-${q.key}`} className="scroll-mt-20 rounded-lg border bg-card">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">
              {q.label} <span className="ml-1 tabular-nums text-muted-foreground">{q.count}</span>
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
        {q.items.map((it: any) => (
          <WorkQueueRow key={it.id} item={it} />
        ))}
      </ul>

      <footer className="border-t px-4 py-2 text-[11px] text-muted-foreground">{q.action_hint}</footer>
    </section>
  );
}
