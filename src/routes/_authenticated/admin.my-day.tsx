/**
 * /admin/my-day — the recruiter's own priority list.
 *
 * Rows are the owned slice of the shared attention, SLA and decision queues,
 * so numbers here always reconcile with those screens. Nothing is invented on
 * the client: ordering, overdue days and links all come from the loader.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyDay } from "@/lib/my-day.functions";
import type { MyDay, MyDayKind } from "@/lib/my-day.server";
import { MY_DAY_KIND_LABEL } from "@/lib/my-day.server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ds";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { AlarmClock, ArrowRight, Clock, Flag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/my-day")({
  head: () => ({
    meta: [
      { title: "My day · TaaSFlow" },
      {
        name: "description",
        content: "The roles you own that need action today, most overdue first.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.my-day.tsx",
  ),
  component: MyDayPage,
});

const KIND_ICON: Record<MyDayKind, typeof Flag> = {
  sla_breach: AlarmClock,
  client_decision: Clock,
  position_attention: Flag,
};

const KIND_TONE: Record<MyDayKind, string> = {
  sla_breach: "bg-destructive/15 text-destructive",
  client_decision: "bg-warning/15 text-warning-foreground",
  position_attention: "bg-info/15 text-info",
};

function MyDayPage() {
  const load = useServerFn(getMyDay);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "my-day"],
    queryFn: () => load({ data: {} }),
    refetchOnWindowFocus: true,
  });

  const day = data as MyDay | undefined;

  return (
    <main className="p-6 md:p-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">My day</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Only the roles you own or back up. Every row is the same record the
          shared queues show — filtered to you and sorted by how overdue it is.
        </p>
      </header>

      {error ? (
        <ErrorState
          title="We could not build your list"
          description={error instanceof Error ? error.message : "Unknown error"}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !day || day.items.length === 0 ? (
        <EmptyState
          title="Nothing needs you right now"
          description={
            day && day.ownedPositions === 0
              ? "No open positions list you as owner or backup owner yet."
              : `${day?.ownedPositions ?? 0} owned position${day?.ownedPositions === 1 ? "" : "s"} checked — none is breaching a commitment, waiting on a client decision, or flagged for attention.`
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {(Object.keys(MY_DAY_KIND_LABEL) as MyDayKind[]).map((kind) => (
              <Card key={kind} className="p-4">
                <div className="text-2xl font-semibold tabular-nums">
                  {day.counts[kind]}
                </div>
                <div className="text-xs text-muted-foreground">
                  {MY_DAY_KIND_LABEL[kind]}
                </div>
              </Card>
            ))}
          </div>

          <ul className="space-y-3">
            {day.items.map((item) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <li key={item.id}>
                  <Link
                    to={item.href}
                    className="flex items-start gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
                  >
                    <span
                      className={`mt-0.5 rounded-md p-2 ${KIND_TONE[item.kind]}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.title}</span>
                        <Badge variant="outline">{item.kindLabel}</Badge>
                        <Badge variant="secondary" className="tabular-nums">
                          {item.daysOverdue}d
                        </Badge>
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {item.detail}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.clientName} · {item.positionTitle}
                      </span>
                    </span>
                    <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 text-xs text-muted-foreground">
            Generated {new Date(day.generated_at).toLocaleString()} ·{" "}
            {day.ownedPositions} owned position
            {day.ownedPositions === 1 ? "" : "s"} checked.
          </p>
        </>
      )}
    </main>
  );
}
