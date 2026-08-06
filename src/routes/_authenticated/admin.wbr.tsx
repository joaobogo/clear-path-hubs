import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIncludeTestRecords } from "@/lib/admin-scope";
import { useState } from "react";
import { toast } from "sonner";
import { getWeeklyOperatingReview } from "@/lib/wbr-review.functions";
import type {
  ReviewMetric,
  ReviewRecord,
  WeeklyReview,
} from "@/lib/wbr-review";
import { reviewToCsv } from "@/lib/wbr-review";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ds";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Lock,
  RefreshCw,
} from "lucide-react";

const DAY = 86_400_000;

function mondayOf(date: Date): string {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysFromMon = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - daysFromMon * DAY).toISOString().slice(0, 10);
}

function shiftWeek(weekStart: string, weeks: number): string {
  return new Date(new Date(`${weekStart}T00:00:00.000Z`).getTime() + weeks * 7 * DAY)
    .toISOString()
    .slice(0, 10);
}

export const Route = createFileRoute("/_authenticated/admin/wbr")({
  validateSearch: (raw: Record<string, unknown>) => ({
    week: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.week ?? ""))
      ? String(raw.week)
      : mondayOf(new Date()),
  }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.wbr.tsx"),
  head: () => ({
    meta: [
      { title: "Weekly operating review · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WbrPage,
});

function fmtWeek(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(new Date(endIso).getTime() - 1);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  return `${s.toLocaleDateString("en-GB", opts)} – ${e.toLocaleDateString("en-GB", { ...opts, year: "numeric" })} UTC`;
}

function RecordLink({ record }: { record: ReviewRecord }) {
  const inner = (
    <>
      <span className="font-medium">{record.label}</span>
      {record.sublabel && (
        <span className="ml-2 text-xs text-muted-foreground">{record.sublabel}</span>
      )}
    </>
  );
  const at = record.at ? (
    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
      {new Date(record.at).toLocaleDateString("en-GB", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })}
    </span>
  ) : null;

  const cls =
    "flex items-center justify-between gap-3 rounded-md border bg-background/60 px-3 py-2 text-sm hover:border-primary/50";

  if (record.kind === "position") {
    return (
      <Link to="/admin/positions/$id" params={{ id: record.id }} className={cls}>
        <span className="truncate">{inner}</span>
        {at}
      </Link>
    );
  }
  if (record.kind === "intake") {
    return (
      <Link to="/admin/intake/$id" params={{ id: record.id }} className={cls}>
        <span className="truncate">{inner}</span>
        {at}
      </Link>
    );
  }
  return (
    <div className={cls}>
      <span className="truncate">{inner}</span>
      {at}
    </div>
  );
}

function MetricCard({ metric }: { metric: ReviewMetric }) {
  const [open, setOpen] = useState(false);
  const diff = metric.current - metric.previous;
  const tone =
    metric.key === "sla_breaches"
      ? diff > 0
        ? "text-destructive"
        : "text-muted-foreground"
      : diff > 0
        ? "text-success"
        : diff < 0
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {metric.label}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-3xl font-semibold tabular-nums">{metric.current}</span>
            <span className={`text-xs tabular-nums ${tone}`}>
              {diff > 0 ? "+" : ""}
              {diff} vs {metric.previous} last week
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{metric.basis}</p>
        </div>
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="space-y-1.5 border-t p-3">
          {metric.records.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              No records in this week.
            </p>
          ) : (
            metric.records.map((r) => <RecordLink key={`${r.kind}-${r.id}`} record={r} />)
          )}
          {metric.truncated && (
            <p className="pt-1 text-xs text-muted-foreground">
              Showing the first {metric.records.length} of {metric.current}. Export the CSV for
              the full list.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function WbrPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const fetchReview = useServerFn(getWeeklyOperatingReview);

  // Scope is admin-wide, so a week's figures match every other desk.
  const includeTest = useIncludeTestRecords();

  const query = useQuery({
    queryKey: ["wbr-review", search.week, includeTest],
    queryFn: () =>
      fetchReview({
        data: { week_start: search.week, include_test: includeTest },
      }) as Promise<WeeklyReview>,
    staleTime: 60_000,
  });

  const thisWeek = mondayOf(new Date());
  const review = query.data;

  const downloadCsv = () => {
    if (!review) return;
    const blob = new Blob([reviewToCsv(review)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taasflow-weekly-review-${review.week_start.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Weekly operating review
          </div>
          <h1 className="mt-1 font-serif text-3xl">
            {review ? fmtWeek(review.week_start, review.week_end) : `Week of ${search.week}`}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            Monday to Sunday, UTC.
            {review?.is_closed && (
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" /> Week closed — figures only change with data
                corrections.
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ search: { ...search, week: shiftWeek(search.week, -1) } })}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous week
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={search.week >= thisWeek}
            onClick={() => navigate({ search: { ...search, week: shiftWeek(search.week, 1) } })}
          >
            Next week
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={search.week === thisWeek}
            onClick={() => navigate({ search: { ...search, week: thisWeek } })}
          >
            This week
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!review}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </header>

      {query.isPending && <LoadingSkeleton />}

      {query.isError && (
        <ErrorState
          title="Could not load this week"
          description={
            (query.error as Error)?.message === "forbidden"
              ? "This review is limited to platform staff."
              : "The weekly figures could not be read. Nothing has changed."
          }
          action={
            <Button size="sm" onClick={() => query.refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Retry
            </Button>
          }
        />
      )}

      {review && !query.isError && review.total_activity === 0 && (
        <EmptyState
          title="No activity in this week"
          description="No intakes, positions, submissions, decisions or hires were recorded between Monday and Sunday UTC."
        />
      )}

      {review && !query.isError && review.total_activity > 0 && (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {review.metrics.map((m) => (
              <MetricCard key={m.key} metric={m} />
            ))}
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold">Roles that regressed</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Fewer candidates submitted than the week before. Ordered by size of the drop.
            </p>
            <div className="mt-3 space-y-1.5">
              {review.regressed_roles.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  No role delivered fewer candidates than the previous week.
                </p>
              ) : (
                review.regressed_roles.map((r) => (
                  <Link
                    key={r.position_id}
                    to="/admin/positions/$id"
                    params={{ id: r.position_id }}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background/60 px-3 py-2 text-sm hover:border-primary/50"
                  >
                    <span className="truncate">
                      <span className="font-medium">{r.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.client_name ?? "Unknown client"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      <Badge variant="destructive" className="tabular-nums">
                        {r.delivered_prev_week} → {r.delivered_this_week} submitted
                      </Badge>
                      <span className="tabular-nums text-muted-foreground">
                        {r.decisions_prev_week} → {r.decisions_this_week} decisions
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
