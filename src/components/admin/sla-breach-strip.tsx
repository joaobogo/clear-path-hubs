/**
 * Compact SLA escalation strip for the admin overview.
 *
 * Rows come straight from `getSlaBreaches`, which derives every figure from
 * `position_commitments` against the real pipeline rows — no forecasting. The
 * server sorts unacknowledged breaches first, then by days over, so the worst
 * missed promise is the first thing an operator reads on the page.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { getSlaBreaches } from "@/lib/admin-sla-breach.functions";

export function SlaBreachStrip({ includeTest }: { includeTest: boolean }) {
  const query = useQuery({
    queryKey: ["admin", "sla-breaches", "overview", includeTest],
    queryFn: () => getSlaBreaches({ data: { include_test: includeTest } }),
    staleTime: 30_000,
  });

  if (query.isLoading || query.isError) return null;

  const rows = (query.data?.rows ?? []).filter((r) => !r.acknowledged);
  if (rows.length === 0) return null;

  const top = rows.slice(0, 4);

  return (
    <section
      aria-labelledby="sla-breach-strip-heading"
      className="rounded-lg border border-destructive/40 bg-destructive/5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/20 px-4 py-2.5">
        <h2
          id="sla-breach-strip-heading"
          className="flex items-center gap-2 text-sm font-semibold text-destructive"
        >
          <AlertTriangle className="h-4 w-4" />
          {rows.length} commitment{rows.length === 1 ? "" : "s"} past {rows.length === 1 ? "its" : "their"} promise
        </h2>
        <Link to="/admin/sla" className="text-xs font-medium text-primary hover:underline">
          Open SLA desk
        </Link>
      </header>
      <ul className="divide-y divide-destructive/15">
        {top.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-xs">
            <span className="w-14 shrink-0 font-semibold tabular-nums text-destructive">
              +{r.days_over}d
            </span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{r.position_title}</span>
              <span className="text-muted-foreground"> · {r.client_name}</span>
            </span>
            <span className="hidden shrink-0 text-muted-foreground sm:inline">
              {r.metric_label}: {r.actual_label} vs {r.target_label}
            </span>
            <Link
              to="/admin/positions/$id"
              params={{ id: r.position_id }}
              className="shrink-0 font-medium text-primary hover:underline"
            >
              Open role
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > top.length ? (
        <footer className="border-t border-destructive/20 px-4 py-2 text-[11px] text-muted-foreground">
          {rows.length - top.length} more on the SLA desk, worst first.
        </footer>
      ) : null}
    </section>
  );
}
