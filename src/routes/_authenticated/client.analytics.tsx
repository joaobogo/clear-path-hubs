import { createFileRoute, Link } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getClientInsights,
  getInsightsPositions,
} from "@/lib/insights.functions";
import { useResolvedClientOrgId } from "@/lib/use-client-org";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NoWorkspaceState } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { AnalyticsSkeleton } from "@/components/ds/page-skeleton";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveNoAnalyticsState } from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignals } from "@/hooks/use-empty-state-signals";
import { usePrefersReducedMotion } from "@/lib/motion/use-motion";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { DropoutQuestion } from "@/components/client/analytics/dropout-question";
import { SpeedQuestion } from "@/components/client/analytics/speed-question";
import { CostQuestion } from "@/components/client/analytics/cost-question";

const RoutePending = makeWorkspacePending({ shape: "kpis", kpis: true, width: "7xl" });
export const Route = createFileRoute("/_authenticated/client/analytics")({
	pendingMs: 150,
	pendingComponent: RoutePending,
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.analytics.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  head: () => ({
    meta: [
      { title: "Three questions · Client workspace" },
      {
        name: "description",
        content:
          "Where candidates drop out, how fast we are against our promise, and what you spent per hire — computed from your own records.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

const WINDOWS = [30, 60, 90, 180];

function AnalyticsPage() {
  // Recharts animates series by default; a reduced-motion reader gets the
  // finished chart immediately instead.
  const reducedMotion = usePrefersReducedMotion();
  const chartAnim = { isAnimationActive: !reducedMotion, animationDuration: 280 } as const;
  // The Insights tabs are reachable straight from the sidebar, without ?org= in
  // the URL. Reading only the search param made this tab claim "no workspace
  // selected" while every sibling tab rendered the workspace fine.
  const orgId = useResolvedClientOrgId();
  const [window, setWindow] = useState(90);
  const [positionId, setPositionId] = useState<string>("all");

  const runInsights = useServerFn(getClientInsights);
  const runPositions = useServerFn(getInsightsPositions);

  const positions = useQuery({
    queryKey: ["insights-positions", orgId],
    queryFn: () => runPositions({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const insights = useQuery({
    queryKey: ["client-insights", orgId, window, positionId],
    queryFn: () =>
      runInsights({
        data: {
          organization_id: orgId!,
          days: window,
          ...(positionId !== "all" ? { position_id: positionId } : {}),
        },
      }),
        enabled: !!orgId,
  });
  const signals = useEmptyStateSignals(orgId ?? undefined, {
    enabled: !insights.isLoading && !insights.data,
  });

  if (!orgId) return <NoWorkspaceState />;

  const data = insights.data;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Three questions
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Where candidates drop out, how fast we are against our promise, and
            what you spent per hire. Every number comes from your own records.
          </p>
          <Link
            to="/client/executive"
            className="mt-2 inline-flex text-sm underline underline-offset-4"
          >
            See what these numbers suggest doing next
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={positionId}
            onValueChange={setPositionId}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {positions.isError && (
                <div className="px-2 py-1.5 text-xs text-destructive">
                  Roles failed to load.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => positions.refetch()}
                  >
                    Retry
                  </button>
                </div>
              )}
              {!positions.isError && (positions.data?.positions ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(window)}
            onValueChange={(v) => setWindow(Number(v))}
          >
            <SelectTrigger className="w-[150px]">
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

      {insights.isError ? (
        <QueryErrorCard
          title="We couldn't calculate these figures"
          error={insights.error}
          onRetry={() => insights.refetch()}
          retrying={insights.isFetching}
        />
      ) : insights.isLoading ? (
        <AnalyticsSkeleton label="Calculating your figures from your own records" />
      ) : !data ? (
        <SurfaceState
          content={resolveNoAnalyticsState({
            observations: signals?.observations ?? 0,
            minimum: 5,
            metricLabel: "Drop-out, speed and spend",
          })}
        />
      ) : (
        <div className="grid gap-6">
          <DropoutQuestion dropout={data.dropout} chartAnim={chartAnim} />
          <SpeedQuestion speed={data.speed} chartAnim={chartAnim} />
          <CostQuestion cost={data.cost} />
        </div>
      )}
    </div>
  );
}
