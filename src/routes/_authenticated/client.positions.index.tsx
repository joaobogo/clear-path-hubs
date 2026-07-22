import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { getClientContext, getClientPositions } from "@/lib/client.functions";
import { Badge } from "@/components/ui/badge";

const searchSchema = z.object({
  tab: fallback(z.string(), "active").default("active"),
});

export const Route = createFileRoute("/_authenticated/client/positions/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Positions · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PositionsPage,
});

const TABS = [
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
  { key: "paused", label: "Paused" },
  { key: "closed", label: "Closed" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function PositionsPage() {
  const { tab } = Route.useSearch();
  const safeTab = TABS.some((t) => t.key === tab) ? (tab as typeof TABS[number]["key"]) : "active";
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(getClientPositions);
  const { data: ctx } = useQuery({
    queryKey: ["client-context", null],
    queryFn: () => ctxFn({ data: {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const { data: rows = [], refetch, isFetching } = useQuery({
    queryKey: ["client-positions", orgId, safeTab],
    queryFn: () => listFn({ data: { orgId: orgId!, status: safeTab } }),
    enabled: !!orgId,
  });
  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener("client:refresh", onRefresh);
    return () => window.removeEventListener("client:refresh", onRefresh);
  }, [refetch]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Positions</h1>
        <div className="text-sm text-muted-foreground">
          {isFetching ? "Loading…" : `${rows.length} positions`}
        </div>
      </header>

      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to="/client/positions"
            search={{ tab: t.key }}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              safeTab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-3">
        {(rows as AnyRow[]).map((p) => (
          <div
            key={p.id}
            className="rounded-lg border bg-card p-4 hover:border-primary transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold truncate">{p.title}</h2>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {p.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {[p.location, p.work_model, p.seniority].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Link
                to="/client/positions/$id"
                params={{ id: p.id }}
                className="text-sm text-primary hover:underline shrink-0"
              >
                Open position →
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <Stat label="Delivered" value={p.kpis.delivered} />
              <Stat label="Top matches" value={p.kpis.top} />
              <Stat label="Shortlisted" value={p.kpis.shortlisted} />
              <Stat label="Interview" value={p.kpis.interviewing} />
              <Stat label="Hires" value={p.kpis.hires} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              {p.next_milestone && (
                <span className="text-muted-foreground">
                  Next: <span className="text-foreground">{p.next_milestone}</span>
                </span>
              )}
              {p.action_required && (
                <span className="text-amber-700 dark:text-amber-300">
                  {p.action_required}
                </span>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && !isFetching && (
          <div className="rounded border bg-card p-8 text-center text-muted-foreground text-sm">
            No positions here yet. Submit an intake to add one.
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-muted/50 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
