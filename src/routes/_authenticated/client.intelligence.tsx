import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getHiringIntelligence,
  getIntelligencePositions,
} from "@/lib/intelligence/hiring-intelligence.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { MetricCard, MetricCardSkeleton } from "@/components/intelligence/metric-card";
import { NoWorkspaceState, ErrorState, EmptyState } from "@/components/client/states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/client/intelligence")({
  head: () => ({
    meta: [
      { title: "Hiring Intelligence · TaaSFlow client workspace" },
      {
        name: "description",
        content:
          "Pipeline health, speed, score distribution, requirement coverage, evidence completeness and role risk — computed from your own records only.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntelligencePage,
});

const WINDOWS = [30, 60, 90, 180];

function IntelligencePage() {
  const orgId = useClientOrgSearch();
  const [days, setDays] = useState(90);
  const [positionId, setPositionId] = useState("all");

  const runIntelligence = useServerFn(getHiringIntelligence);
  const runPositions = useServerFn(getIntelligencePositions);

  const positions = useQuery({
    queryKey: ["intelligence-positions", orgId],
    queryFn: () => runPositions({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const intel = useQuery({
    queryKey: ["hiring-intelligence", orgId, days, positionId],
    queryFn: () =>
      runIntelligence({
        data: {
          organization_id: orgId!,
          days,
          ...(positionId !== "all" ? { position_id: positionId } : {}),
        },
      }),
    enabled: !!orgId,
  });

  if (!orgId) return <NoWorkspaceState />;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hiring Intelligence</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Eleven measures, each answering one decision. Every figure comes from your
            own records — nothing is estimated, benchmarked or filled in. Where a
            measure cannot be computed, it says so.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={positionId} onValueChange={setPositionId}>
            <SelectTrigger className="w-[220px]" aria-label="Filter by role">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {(positions.data?.positions ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[150px]" aria-label="Time window">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Last {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {intel.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <MetricCardSkeleton key={i} />
          ))}
        </div>
      ) : intel.isError ? (
        <ErrorState
          title="Intelligence could not be loaded"
          description="Your records are safe — this screen simply could not read them. Nothing shown below would have been reliable, so nothing is shown."
          onRetry={() => intel.refetch()}
        />
      ) : !intel.data ? (
        <EmptyState
          title="Nothing to measure yet"
          description="Once a role is live and candidates are released to you, every measure on this screen fills in from your own records."
        />
      ) : (
        <>
          {intel.data.emptyWorkspace && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              This workspace has no roles, candidates or scoring runs in scope yet, so
              every measure below reports its own empty state rather than a chart.{" "}
              <Link to="/client/positions" className="underline">
                Open a role
              </Link>{" "}
              to start the record trail.
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {intel.data.metrics.map((m) => (
              <MetricCard key={m.key} metric={m} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Window: last {intel.data.window.days} days, compared with the {intel.data.window.days}{" "}
            days before it where a baseline exists. Computed{" "}
            {new Date(intel.data.computedAt).toLocaleString("en-GB")}.
          </p>
        </>
      )}
    </div>
  );
}
