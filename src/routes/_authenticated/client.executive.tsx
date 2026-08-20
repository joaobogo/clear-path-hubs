import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client-context.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { getExecutiveReport } from "@/lib/executive.functions";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { DegradedPanelsBanner } from "@/components/client/degraded-banner";
import { panelReadiness, panelSignal } from "@/lib/panel-readiness";
import { SkeletonStats } from "@/components/client/states";
import {
  FinanceStrip,
  RegionCard,
  BottlenecksCard,
  PipelineByBU,
  TimeInStageCard,
  VelocityCard,
  FooterLine,
} from "@/components/client/executive/cards";

export const Route = createFileRoute("/_authenticated/client/executive")({
  head: () => ({
    meta: [
      { title: "Executive portfolio · TaaSFlow" },
      {
        name: "description",
        content:
          "Enterprise leadership view: open roles by region, hiring health by business unit, time-in-stage, bottlenecks, delivery velocity, shortlist quality, and finance-ready hiring summary.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.executive.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  component: ExecutivePage,
});

function ExecutivePage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const reportFn = useServerFn(getExecutiveReport);

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctxState = useQueryState(ctxQuery);
  const orgId = ctxState.data?.active?.organization_id;

  const reportQuery = useQuery({
    queryKey: ["executive-report", orgId],
    queryFn: () => reportFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    staleTime: 60_000,
  });
  const reportState = useQueryState(reportQuery);

  // Same multi-query shape as the overview: one readiness summary, no
  // confident figures from a failed or out-of-date read.
  const readiness = panelReadiness([
    panelSignal("Workspace access", ctxQuery),
    panelSignal("Portfolio report", reportQuery),
  ]);
  const reportNotCurrent = readiness.isNotCurrent("Portfolio report");

  if (ctxState.isError) {
    return (
      <div className="p-6 md:p-8">
        <QueryErrorCard error={ctxState.error} onRetry={ctxState.retry} retrying={ctxState.retrying} />
      </div>
    );
  }

  if (ctxState.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
        <SkeletonStats />
      </div>
    );
  }

  if (reportState.isError) {
    return (
      <div className="p-6 md:p-8">
        <QueryErrorCard error={reportState.error} onRetry={reportState.retry} retrying={reportState.retrying} />
      </div>
    );
  }

  if (!orgId || reportState.isLoading || !reportState.data) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
        <SkeletonStats />
      </div>
    );
  }

  const data = reportState.data;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Leadership view
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Executive portfolio</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          One glance at the whole hiring system: where roles are open, where pipeline is
          flowing, where it&apos;s stuck, and what&apos;s about to close. Everything below is
          computed live from your workspace.
        </p>
      </header>

      <DegradedPanelsBanner retrying={readiness.retrying} panels={readiness.signals} />

      <FinanceStrip
        fin={data.finance_summary}
        notCurrent={reportNotCurrent}
        notCurrentReason={readiness.reasonFor("Portfolio report")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RegionCard rows={data.open_by_region} />
        <BottlenecksCard rows={data.bottlenecks} />
      </div>

      <PipelineByBU rows={data.pipeline_by_bu} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TimeInStageCard rows={data.time_in_stage} />
        <VelocityCard delivery={data.delivery_velocity} quality={data.shortlist_quality} />
      </div>

      <FooterLine generated_at={data.generated_at} />
    </div>
  );
}
