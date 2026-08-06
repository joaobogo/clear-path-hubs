/**
 * Portfolio Health — the top of /admin.
 *
 * One row per client account with an open position. Bands are computed
 * server-side from the stated rule and always carry a text label plus the
 * reasons, so the signal never depends on colour alone.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPortfolioHealth } from "@/lib/admin-portfolio.functions";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";

type Health = Awaited<ReturnType<typeof getPortfolioHealth>>;
type Row = Health["rows"][number];

type SortKey =
  | "organization_name"
  | "band"
  | "plan_label"
  | "open_positions"
  | "positions_without_submissions"
  | "oldest_open_position_days"
  | "submissions_last_7_days"
  | "pending_client_decisions"
  | "days_since_client_visible_activity";

const COLUMNS: Array<{ key: SortKey; label: string; numeric: boolean; help?: string }> = [
  { key: "organization_name", label: "Account", numeric: false },
  { key: "band", label: "Health", numeric: false },
  { key: "plan_label", label: "Plan", numeric: false },
  { key: "open_positions", label: "Open", numeric: true, help: "Open positions" },
  {
    key: "positions_without_submissions",
    label: "No subs",
    numeric: true,
    help: "Open positions with zero candidates submitted to the client",
  },
  {
    key: "oldest_open_position_days",
    label: "Oldest",
    numeric: true,
    help: "Age in days of the oldest position counted above",
  },
  { key: "submissions_last_7_days", label: "Subs 7d", numeric: true, help: "Candidates submitted in the last 7 days" },
  {
    key: "pending_client_decisions",
    label: "Awaiting client",
    numeric: true,
    help: "Delivered candidates with no client decision yet",
  },
  {
    key: "days_since_client_visible_activity",
    label: "Quiet",
    numeric: true,
    help: "Days since the last client-visible submission or decision",
  },
];

const BAND_LABEL: Record<Row["band"], string> = {
  at_risk: "At risk",
  watch: "Watch",
  healthy: "Healthy",
};

const BAND_CLASS: Record<Row["band"], string> = {
  at_risk: "border-destructive/40 text-destructive",
  watch: "border-warning/50 text-warning-foreground",
  healthy: "border-border text-muted-foreground",
};

const BAND_ORDER: Record<Row["band"], number> = { at_risk: 0, watch: 1, healthy: 2 };

function num(v: number | null): string {
  return v === null ? "—" : String(v);
}

export function PortfolioHealthTable({ includeTest }: { includeTest: boolean }) {
  const query = useQuery({
    queryKey: ["admin-portfolio-health", includeTest],
    queryFn: () => getPortfolioHealth({ data: { include_test: includeTest } }),
    staleTime: 30_000,
  });

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "band",
    dir: "asc",
  });

  const rows = useMemo(() => {
    const list = [...(query.data?.rows ?? [])];
    const { key, dir } = sort;
    list.sort((a, b) => {
      let cmp: number;
      if (key === "band") cmp = BAND_ORDER[a.band] - BAND_ORDER[b.band];
      else if (key === "organization_name" || key === "plan_label")
        cmp = String(a[key] ?? "").localeCompare(String(b[key] ?? ""));
      else cmp = Number(a[key] ?? -1) - Number(b[key] ?? -1);
      if (cmp === 0) cmp = a.organization_name.localeCompare(b.organization_name);
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [query.data, sort]);

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="portfolio-health-heading">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id="portfolio-health-heading" className="text-sm font-semibold">
            Portfolio health
          </h2>
          <p className="text-xs text-muted-foreground">
            One row per client account with an open position. At risk = an open position with no
            submissions older than 14 days, or more than 5 candidates awaiting a client decision, or
            10+ days without client-visible activity. Watch = half those thresholds.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          aria-label="Refresh portfolio health"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <PanelState
        query={query}
        isEmpty={rows.length === 0}
        empty={
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium">No active client accounts yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Accounts appear here as soon as they have an open position.
            </p>
            <Button asChild size="sm" variant="secondary" className="mt-3 h-7 text-xs">
              <Link to="/admin/clients_new">Add a client account</Link>
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                {COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      className={`whitespace-nowrap px-3 py-2 font-medium ${c.numeric ? "text-right" : "text-left"}`}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        title={c.help}
                        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
                        onClick={() =>
                          setSort((prev) =>
                            prev.key === c.key
                              ? { key: c.key, dir: prev.dir === "asc" ? "desc" : "asc" }
                              : { key: c.key, dir: c.numeric ? "desc" : "asc" },
                          )
                        }
                      >
                        {c.label}
                        {active ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.organization_id} className="hover:bg-muted/40">
                  <td className="max-w-[18rem] px-3 py-2">
                    <Link
                      to="/admin/clients/$id"
                      params={{ id: r.organization_id }}
                      className="block truncate font-medium hover:underline"
                    >
                      {r.organization_name}
                      {r.is_test_record ? (
                        <span className="ml-2 text-[11px] text-muted-foreground">test</span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${BAND_CLASS[r.band]}`}
                      title={r.band_reasons.join(" · ")}
                    >
                      {BAND_LABEL[r.band]}
                    </span>
                    <span className="ml-2 hidden text-[11px] text-muted-foreground xl:inline">
                      {r.band_reasons[0]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {r.plan_label ?? "—"}
                    {r.subscription_state ? ` · ${r.subscription_state}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.open_positions}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.positions_without_submissions}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {num(r.oldest_open_position_days)}
                    {r.oldest_open_position_days === null ? "" : "d"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.submissions_last_7_days}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.pending_client_decisions}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {num(r.days_since_client_visible_activity)}
                    {r.days_since_client_visible_activity === null ? "" : "d"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>
    </section>
  );
}
