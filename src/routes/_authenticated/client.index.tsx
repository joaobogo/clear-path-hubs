import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getClientContext, getClientOverview } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { CandidateCard } from "@/components/client/candidate-card";

export const Route = createFileRoute("/_authenticated/client/")({
  head: () => ({
    meta: [
      { title: "Overview · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OverviewPage,
});

type KpiKey =
  | "delivered"
  | "top"
  | "shortlisted"
  | "interviewing"
  | "interview_scheduled"
  | "hires"
  | "active_positions";

const KPI_META: Record<KpiKey, { label: string; sub: string; href: string; filter?: string }> = {
  active_positions: {
    label: "Active positions",
    sub: "Roles TaaSFlow is currently working on",
    href: "/client/positions",
  },
  delivered: {
    label: "Candidates delivered",
    sub: "Unique profiles visible to your team",
    href: "/client/candidates",
    filter: "all",
  },
  top: {
    label: "Top matches",
    sub: "Approved excellent or strong fit",
    href: "/client/candidates",
    filter: "top",
  },
  shortlisted: {
    label: "Shortlisted",
    sub: "Currently in your shortlist",
    href: "/client/candidates",
    filter: "shortlisted",
  },
  interviewing: {
    label: "In interview process",
    sub: "Requested, scheduled or completed",
    href: "/client/candidates",
    filter: "interview",
  },
  interview_scheduled: {
    label: "Interviews scheduled",
    sub: "Confirmed upcoming interviews",
    href: "/client/candidates",
    filter: "interview",
  },
  hires: {
    label: "Hires",
    sub: "Confirmed hires to date",
    href: "/client/candidates",
    filter: "hired",
  },
};

const KPI_ORDER: KpiKey[] = [
  "active_positions",
  "delivered",
  "top",
  "shortlisted",
  "interviewing",
  "interview_scheduled",
  "hires",
];

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
  const actions = data?.action_required ?? [];
  const latest = data?.latest_candidates ?? [];
  const messages = data?.recent_messages ?? [];
  const activity = data?.recent_activity ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          What TaaSFlow has delivered — and what needs your attention.
        </p>
        {data?.last_updated && (
          <p className="mt-1 text-xs text-muted-foreground">
            Last updated {new Date(data.last_updated).toLocaleString()}
          </p>
        )}
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {KPI_ORDER.map((k) => {
          const meta = KPI_META[k];
          const value = kpis ? (kpis as Record<KpiKey, number>)[k] : null;
          return (
            <Link
              key={k}
              to={meta.href}
              search={
                meta.filter
                  ? (prev: Record<string, unknown>) => ({ ...prev, filter: meta.filter })
                  : undefined
              }
              className="group block rounded-lg border bg-card p-4 hover:border-primary transition"
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {meta.label}
              </div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">
                {value ?? (isFetching ? "…" : 0)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{meta.sub}</div>
            </Link>
          );
        })}
      </section>

      {actions.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-medium mb-3">Client action required</h2>
          <ul className="space-y-2">
            {actions.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded border p-3">
                <span className="text-sm">{a.label}</span>
                <Link to={a.href} className="text-sm text-primary hover:underline shrink-0">
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Latest delivered candidates</h2>
          <Link to="/client/candidates" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>
        {latest.length === 0 ? (
          <div className="rounded border bg-card p-8 text-center text-sm text-muted-foreground">
            No candidates yet — TaaSFlow will notify you when the first ones are ready.
          </div>
        ) : (
          <div className="grid gap-3">
            {latest.map((c) => (
              <CandidateCard key={c.match_id} candidate={c} />
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Recent messages</h2>
            <Link to="/client/messages" className="text-sm text-primary hover:underline">
              Open messages →
            </Link>
          </div>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {messages.map((m) => (
                <li key={m.id} className="border-b pb-2 last:border-b-0">
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div className="line-clamp-2">{m.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-medium mb-2">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {activity.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3">
                  <span className="capitalize">
                    {String(e.action).replace(/_/g, " ")} · {String(e.entity_type).replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
