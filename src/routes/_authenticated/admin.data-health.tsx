import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { getDataHealth } from "@/lib/data-system.functions";
import { DataHealthExceptionsPanel } from "@/components/admin/data-health-exceptions-panel";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";


export const Route = createFileRoute("/_authenticated/admin/data-health")({
  head: () => ({
    meta: [
      { title: "Data health · Admin" },
      {
        name: "description",
        content:
          "Coverage, freshness, duplicate rate, extraction failures and orphaned records across the TaaSFlow data spine.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.data-health.tsx",
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Not found.</div>
  ),
  component: DataHealthPage,
});

function when(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stat({
  label,
  value,
  tone = "neutral",
  detail,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          "mt-1 text-2xl font-semibold tabular-nums " +
          (tone === "warn"
            ? "text-destructive"
            : tone === "good"
              ? "text-emerald-600 dark:text-emerald-400"
              : "")
        }
      >
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function DataHealthMetrics() {
  const fn = useServerFn(getDataHealth);
  const { data, isPending, error } = useQuery({
    queryKey: ["data-health"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });

  if (isPending)
    return (
      <div className="py-8 text-sm text-muted-foreground">
        Measuring the data spine…
      </div>
    );
  if (error || !data)
    return (
      <div className="py-8 text-sm text-destructive">
        Could not read data health. {(error as Error)?.message}
      </div>
    );

  const orphanTotal =
    data.orphans.matches_without_person +
    data.orphans.evidence_without_match +
    data.orphans.signals_without_position;

  return (
    <>
      <p className="mt-8 text-xs text-muted-foreground">
        Measured {when(data.generated_at)}
      </p>


      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="People in graph"
          value={data.graph.persons.toLocaleString()}
          detail={`${data.graph.edges.toLocaleString()} edges · ${data.graph.density} per person`}
        />
        <Stat
          label="Duplicate rate"
          value={`${data.duplicates.duplicate_rate}%`}
          tone={data.duplicates.duplicate_rate > 10 ? "warn" : "good"}
          detail={`${data.duplicates.merged_persons} merged of ${data.duplicates.persons}`}
        />
        <Stat
          label="Extraction failures"
          value={`${data.extraction.failure_rate}%`}
          tone={data.extraction.failure_rate > 5 ? "warn" : "good"}
          detail={`${data.extraction.files_failed} of ${data.extraction.files_total} files`}
        />
        <Stat
          label="Orphaned records"
          value={orphanTotal.toLocaleString()}
          tone={orphanTotal > 0 ? "warn" : "good"}
          detail="Rows that cannot be traced to an owner"
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Field coverage</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Share of candidate records that carry each field. Thin coverage here
            is what makes matching guess.
          </p>
          <ul className="mt-4 space-y-3">
            {data.coverage.map((c) => (
              <li key={c.field}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{c.field}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.present}/{c.total} · {c.pct}%
                  </span>
                </div>
                <Progress value={c.pct} className="mt-1.5 h-1.5" />
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
              Freshness
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Newest candidate</dt>
                <dd>{when(data.freshness.newest_candidate)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Newest evidence</dt>
                <dd>{when(data.freshness.newest_evidence)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Newest signal</dt>
                <dd>{when(data.freshness.newest_signal)}</dd>
              </div>
            </dl>
            {data.freshness.stale_days !== null &&
              data.freshness.stale_days > 14 && (
                <p className="mt-3 flex items-start gap-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5" aria-hidden />
                  No new candidate in {data.freshness.stale_days} days. Check
                  intake and the job board.
                </p>
              )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Orphans</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Matches with no candidate
                </span>
                <span className="tabular-nums">
                  {data.orphans.matches_without_person}
                </span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Evidence with no match
                </span>
                <span className="tabular-nums">
                  {data.orphans.evidence_without_match}
                </span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Signals with no position
                </span>
                <span className="tabular-nums">
                  {data.orphans.signals_without_position}
                </span>
              </li>
            </ul>
            {orphanTotal === 0 && (
              <p className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Every record traces back to an owner.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Graph edges by kind</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(data.graph.edges_by_kind).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No edges recorded yet.
                </p>
              ) : (
                Object.entries(data.graph.edges_by_kind).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="font-normal">
                    {k.replace(/_/g, " ")}: {v.toLocaleString()}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function DataHealthPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Database className="h-6 w-6 text-primary" aria-hidden />
          Data health
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Broken records that block operations, plus coverage, freshness, duplicates and
          extraction failures. Read live from the tables themselves.
        </p>
      </header>

      <div className="mt-8">
        <DataHealthExceptionsPanel />
      </div>

      <DataHealthMetrics />
    </div>
  );
}

