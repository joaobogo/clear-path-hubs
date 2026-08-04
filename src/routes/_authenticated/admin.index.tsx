import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { getAdminWorkQueues } from "@/lib/admin-ops.functions";
import { TestRecordsToggle } from "@/components/admin/TestRecordsToggle";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Briefcase,
  ClipboardCheck,
  Clock,
  CalendarClock,
  AlertOctagon,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import type { ComponentType } from "react";

const searchSchema = z.object({
  show_test: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_authenticated/admin/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ show_test: search.show_test }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-work-queues", deps.show_test],
      queryFn: () => getAdminWorkQueues({ data: { include_test: deps.show_test } }),
    }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.index.tsx"),
  head: () => ({
    meta: [
      { title: "Work queue · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Overview,
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


function waited(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${Math.max(m, 1)}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function toneClass(tone: string) {
  if (tone === "danger") return "text-destructive";
  if (tone === "warning") return "text-warning-foreground";
  return "text-muted-foreground";
}

function Overview() {
  const qc = useQueryClient();
  const { data, isFetching } = useSuspenseQuery({
    queryKey: ["admin-work-queues"],
    queryFn: () => getAdminWorkQueues(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const queues = data.queues;
  const total = queues.reduce((n, q) => n + q.count, 0);

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
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-work-queues"] })}
          disabled={isFetching}
          aria-label="Refresh work queue"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {/* Counts strip — each jumps to its queue below. */}
      <nav aria-label="Queue counts" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {queues.map((q) => {
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

              {q.items.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-8 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Clear — nothing in this queue.
                </div>
              ) : (
                <ul className="divide-y">
                  {q.items.map((it) => (
                    <li key={it.id} className="group flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{it.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {it.subtitle}
                          {it.meta ? ` · ${it.meta}` : ""}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 tabular-nums text-xs ${toneClass(it.tone)}`}
                        title="Waiting"
                      >
                        {waited(it.waiting_since)}
                      </span>
                      <Button asChild size="sm" variant="secondary" className="h-7 shrink-0 text-xs">
                        <Link to={it.to} params={it.params as never}>
                          {it.action_label}
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <footer className="border-t px-4 py-2 text-[11px] text-muted-foreground">
                {q.action_hint}
              </footer>
            </section>
          );
        })}
      </div>

      <ActivityFeed />
    </div>
  );
}
