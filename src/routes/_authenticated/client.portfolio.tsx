/**
 * /client/portfolio — Enterprise multi-business-unit rollup.
 *
 * Only meaningful when the active org is a parent (or a child inside one).
 * Otherwise renders a compact "single-unit" empty state.
 *
 * Filter surface intentionally small: region + business unit only. Drill-
 * through routes to /client/positions?org=<unit> (child scope).
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getClientContext } from "@/lib/client.functions";
import { getPortfolioRollup, type PortfolioRollupRow } from "@/lib/portfolio.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Building2, ArrowRight, MapPin, Layers } from "lucide-react";
import { QueryErrorCard } from "@/components/client/query-error";

export const Route = createFileRoute("/_authenticated/client/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const orgId = useClientOrgSearch();
  const getRollup = useServerFn(getPortfolioRollup);
  const getCtx = useServerFn(getClientContext);

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgId ?? null],
    queryFn: () => getCtx({ data: orgId ? { orgId } : {} }),
  });
  const ctx = ctxQuery.data;

  const activeOrgId = ctx?.active?.organization_id;

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["portfolio-rollup", activeOrgId],
    queryFn: () => getRollup({ data: { orgId: activeOrgId! } }),
    enabled: Boolean(activeOrgId),
  });

  const [region, setRegion] = useState<string>("");
  const [bu, setBu] = useState<string>("");

  const filtered = useMemo<readonly PortfolioRollupRow[]>(() => {
    if (!data) return [];
    return data.rows.filter(
      (r) =>
        (region === "" || r.region === region) &&
        (bu === "" || r.business_unit === bu),
    );
  }, [data, region, bu]);

  const groupedByUnit = useMemo(() => {
    const map = new Map<string, { name: string; rows: PortfolioRollupRow[] }>();
    for (const r of filtered) {
      if (!map.has(r.organization_id)) {
        map.set(r.organization_id, { name: r.organization_name, rows: [] });
      }
      map.get(r.organization_id)!.rows.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (ctxQuery.isError) {
    return (
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <QueryErrorCard
          title="We couldn't load your workspace"
          error={ctxQuery.error}
          onRetry={() => ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      </main>
    );
  }

  if (!activeOrgId) {
    return <div className="p-8 text-muted-foreground">Loading workspace…</div>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Enterprise view
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
          Portfolio
          {data?.parent.is_parent ? (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              · {data.parent.name}
            </span>
          ) : null}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Rollup across business units and regions. Drill through into any unit to see its
          positions, candidates, and pipeline stages.
        </p>
      </header>

      {isError ? (
        <QueryErrorCard
          title="We couldn't load the portfolio rollup"
          error={error}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Loading rollup…</div>
      ) : null}

      {!isError && data && !data.parent.is_parent && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          This organization isn't linked to a parent portfolio yet. Portfolio rollups become
          available when two or more business units share a parent record.
        </div>
      )}

      {!isError && data && data.parent.is_parent && (
        <>
          {/* KPI tiles */}
          <section className="grid gap-3 sm:grid-cols-4">
            <Tile label="Open positions" value={data.totals.open_positions} />
            <Tile label="Filled positions" value={data.totals.filled_positions} />
            <Tile label="Candidates in flight" value={data.totals.candidates_in_flight} />
            <Tile label="Hires" value={data.totals.hires} />
          </section>

          {/* Filters */}
          <section className="flex flex-wrap items-center gap-3 rounded-lg border bg-card/60 px-4 py-3 text-sm">
            <div className="inline-flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Region
            </div>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="">All regions</option>
              {data.regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <div className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Layers className="h-3.5 w-3.5" aria-hidden /> Business unit
            </div>
            <select
              value={bu}
              onChange={(e) => setBu(e.target.value)}
              className="h-9 rounded-md border bg-background px-2"
            >
              <option value="">All business units</option>
              {data.business_units.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {(region || bu) && (
              <button
                onClick={() => { setRegion(""); setBu(""); }}
                className="ml-auto text-xs font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </section>

          {/* Units */}
          <section className="space-y-4">
            {groupedByUnit.length === 0 && (
              <div className="rounded-lg border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                No units match those filters.
              </div>
            )}
            {groupedByUnit.map(([unitId, unit]) => {
              const t = unit.rows.reduce(
                (acc, r) => ({
                  open: acc.open + Number(r.open_positions ?? 0),
                  filled: acc.filled + Number(r.filled_positions ?? 0),
                  flight: acc.flight + Number(r.candidates_in_flight ?? 0),
                  hires: acc.hires + Number(r.hires ?? 0),
                }),
                { open: 0, filled: 0, flight: 0, hires: 0 },
              );
              return (
                <div
                  key={unitId}
                  className="rounded-xl border bg-card p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 text-base font-semibold">
                        <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                        {unit.name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {unit.rows.length} segment{unit.rows.length === 1 ? "" : "s"} ·{" "}
                        {t.open} open · {t.flight} in flight · {t.hires} hire{t.hires === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Link
                      to="/client/positions"
                      search={{ org: unitId }}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Drill through <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>

                  {unit.rows.length > 0 && (
                    <div className="taas-stack-scroll mt-4 overflow-x-auto rounded-lg border max-sm:border-0">
                      <table className="taas-stack-table w-full text-sm sm:min-w-[520px]">

                        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left">Business unit</th>
                            <th className="px-3 py-2 text-left">Region</th>
                            <th className="px-3 py-2 text-right">Open</th>
                            <th className="px-3 py-2 text-right">In flight</th>
                            <th className="px-3 py-2 text-right">Hires</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unit.rows.map((r, i) => (
                            <tr
                              key={`${r.business_unit}-${r.region}-${i}`}
                              className="border-t"
                            >
                              <td data-label="Business unit" className="px-3 py-2">{r.business_unit}</td>
                              <td data-label="Region" className="px-3 py-2 text-muted-foreground">{r.region}</td>
                              <td data-label="Open" className="px-3 py-2 text-right font-medium sm:text-right max-sm:text-left">{r.open_positions}</td>
                              <td data-label="In flight" className="px-3 py-2 text-right max-sm:text-left">{r.candidates_in_flight}</td>
                              <td data-label="Hires" className="px-3 py-2 text-right max-sm:text-left">{r.hires}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
