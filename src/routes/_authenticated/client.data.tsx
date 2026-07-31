import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, LineChart, Users, TrendingUp } from "lucide-react";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import {
  getDataAdvantage,
  getMarketIntelligence,
} from "@/lib/data-system.functions";
import { ProvenanceFigure } from "@/components/ds/provenance-figure";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/client/data")({
  head: () => ({
    meta: [
      { title: "Your data advantage · Client workspace" },
      {
        name: "description",
        content:
          "What TaaSFlow holds for your organisation, where each figure comes from, and how it compounds with every closed search.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "client",
    "src/routes/_authenticated/client.data.tsx",
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Not found.</div>
  ),
  component: DataAdvantagePage,
});

function fmt(n: number) {
  return n.toLocaleString();
}

function DataAdvantagePage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const advantageFn = useServerFn(getDataAdvantage);
  const marketFn = useServerFn(getMarketIntelligence);

  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;

  const { data, isPending } = useQuery({
    queryKey: ["data-advantage", orgId],
    queryFn: () => advantageFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const { data: market } = useQuery({
    queryKey: ["market-intelligence"],
    queryFn: () => marketFn({ data: {} }),
  });

  if (!orgId || isPending) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Reading what we hold for you…
      </div>
    );
  }

  const growth = data?.growth_this_month;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Database className="h-6 w-6 text-primary" aria-hidden />
          Your data advantage
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Everything on this page is counted from your own records. Click the
          information mark on any figure to see the tables it was read from and
          how many records went into it.
        </p>
      </header>

      {data?.is_new_account ? (
        <section className="mt-8 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
          <TrendingUp
            className="mx-auto h-8 w-8 text-muted-foreground"
            aria-hidden
          />
          <h2 className="mt-3 text-lg font-medium">
            Nothing held yet — that starts with your first role
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            We do not seed accounts with sample data. From the moment your first
            role goes live, every applicant, every piece of evidence and every
            decision is recorded here and stays useful for the searches after
            it.
          </p>
        </section>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProvenanceFigure
              label="People known"
              value={fmt(data!.people.value)}
              provenance={data!.people.provenance}
              caption="Distinct humans, deduplicated across applications"
            />
            <ProvenanceFigure
              label="Evidence items"
              value={fmt(data!.evidence_items.value)}
              provenance={data!.evidence_items.provenance}
              caption="Extracted and checked against your requirements"
            />
            <ProvenanceFigure
              label="Interactions recorded"
              value={fmt(data!.interactions.value)}
              provenance={data!.interactions.provenance}
              caption="Outreach and interviews, at person level"
            />
            <ProvenanceFigure
              label="Roles benchmarked"
              value={fmt(data!.roles_benchmarked.value)}
              provenance={data!.roles_benchmarked.provenance}
              caption="Closed searches that fed the system"
            />
            <ProvenanceFigure
              label="Signals written back"
              value={fmt(data!.signals_added.value)}
              provenance={data!.signals_added.provenance}
              caption="Stage timings, drop-outs, packages, realism"
            />
          </section>

          {growth && (
            <section className="mt-6 rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                Added this month
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Since{" "}
                {new Date(growth.since).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                })}
                : {fmt(growth.people)} more people, {fmt(growth.evidence_items)}{" "}
                more evidence items and {fmt(growth.signals)} more signals from
                closed searches. Each one makes the next shortlist faster to
                assemble.
              </p>
            </section>
          )}
        </>
      )}

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LineChart className="h-5 w-5 text-muted-foreground" aria-hidden />
          Market benchmarks
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Drawn from closed searches across the platform. We only publish a
          benchmark once it rests on at least{" "}
          {market?.min_closed_searches ?? 5} closed searches. Anything thinner
          stays hidden rather than being dressed up as insight.
        </p>

        {market && market.rows.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Market benchmarks by role family and region
              </caption>
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Role family
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Region
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Measure
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Median
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Closed searches
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {market.rows.map((r) => (
                  <tr
                    key={`${r.role_family}-${r.region}-${r.signal_key}`}
                    className="hover:bg-muted/30"
                  >
                    <td className="px-4 py-2 font-medium">{r.role_family}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.region}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.signal_key.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.median_value === null
                        ? "—"
                        : `${r.currency ? `${r.currency} ` : ""}${fmt(Math.round(r.median_value))}`}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {r.closed_searches}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            No benchmark has reached the minimum sample size yet. We would
            rather show you nothing than a median built on two searches.
          </div>
        )}

        {market && market.withheld > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            <Badge variant="outline" className="mr-2">
              {market.withheld} withheld
            </Badge>
            Benchmarks below the minimum sample size are held back until enough
            searches close.
          </p>
        )}
      </section>
    </main>
  );
}
