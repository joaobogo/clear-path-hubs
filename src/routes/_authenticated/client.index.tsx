import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getClientContext, getClientOverview } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";


export const Route = createFileRoute("/_authenticated/client/")({
  head: () => ({
    meta: [
      { title: "Overview · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OverviewPage,
});

type KpiKey = "delivered" | "top" | "shortlisted" | "interviewing" | "hires";

const KPI_META: Record<KpiKey, { label: string; sub: string; filter: string }> = {
  delivered: {
    label: "Candidates delivered",
    sub: "Unique profiles visible to your team",
    filter: "all",
  },
  top: {
    label: "Top matches",
    sub: "Approved excellent or strong fit",
    filter: "top",
  },
  shortlisted: {
    label: "Shortlisted",
    sub: "Currently in your shortlist",
    filter: "shortlisted",
  },
  interviewing: {
    label: "In interview process",
    sub: "Requested, scheduled or completed",
    filter: "interview",
  },
  hires: {
    label: "Hires",
    sub: "Confirmed hires to date",
    filter: "hired",
  },
};

function OverviewPage() {
  const ctxFn = useServerFn(getClientContext);
  const overviewFn = useServerFn(getClientOverview);
  const orgSearch = useClientOrgSearch();
  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["client-overview", orgId],
    queryFn: () => overviewFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener("client:refresh", onRefresh);
    return () => window.removeEventListener("client:refresh", onRefresh);
  }, [refetch]);

  const kpis = data?.kpis;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          What TaaSFlow has delivered — and what to review next.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        {(Object.keys(KPI_META) as KpiKey[]).map((k) => {
          const meta = KPI_META[k];
          const value = kpis ? (kpis as Record<KpiKey, number>)[k] : null;
          if (k === "hires" && (value ?? 0) === 0) return null;
          return (
            <Link
              key={k}
              to="/client/candidates"
              search={{ filter: meta.filter }}
              className="group block rounded-lg border bg-card p-4 hover:border-primary transition"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {meta.label}
              </div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">
                {value ?? (isFetching ? "…" : 0)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{meta.sub}</div>
              <div className="mt-2 text-xs text-primary opacity-0 group-hover:opacity-100">
                Open →
              </div>
            </Link>
          );
        })}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">Where to focus</h2>
          <div className="text-xs text-muted-foreground">
            {data?.active_positions ?? 0} active positions
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            to="/client/candidates"
            search={{ filter: "new" }}
            className="rounded border p-3 hover:border-primary transition"
          >
            <div className="text-sm font-medium">New to review</div>
            <div className="text-xs text-muted-foreground mt-1">
              Candidates delivered but not yet shortlisted.
            </div>
          </Link>
          <Link
            to="/client/candidates"
            search={{ filter: "interview" }}
            className="rounded border p-3 hover:border-primary transition"
          >
            <div className="text-sm font-medium">Interview outcomes</div>
            <div className="text-xs text-muted-foreground mt-1">
              Candidates currently in your interview process.
            </div>
          </Link>
          <Link
            to="/client/messages"
            className="rounded border p-3 hover:border-primary transition"
          >
            <div className="text-sm font-medium">Message TaaSFlow</div>
            <div className="text-xs text-muted-foreground mt-1">
              Ask a question or share feedback on any role.
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
