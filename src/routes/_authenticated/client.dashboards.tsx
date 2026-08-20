/**
 * Personalised dashboards.
 *
 * A paid entitlement: annual subscribers and accounts with an add-on get to
 * compose their own view. Everyone else sees exactly what it is, what it
 * costs, and how to get it — no teasing, no half-loaded charts.
 */
import { useMemo, useState } from "react";
import { formatEnumLabel } from "@/lib/human-labels";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getClientContext } from "@/lib/client-context.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import {
  DEFAULT_DASHBOARD_BLOCKS,
  getDashboardBlocks,
  getDashboardWorkspace,
  saveDashboard,
} from "@/lib/dashboards.functions";
import { BLOCK_LIBRARY, type BlockId } from "@/lib/dashboards/blocks";
import { DashboardBlock } from "@/components/client/dashboards/dashboard-block";
import { LockedPanel } from "@/components/client/dashboards/locked-panel";
import { AddBlockMenu, SaveDraft } from "@/components/client/dashboards/block-editing";
import { ExportMenu } from "@/components/client/dashboards/export-menu";
import { ScheduleDialog } from "@/components/client/dashboards/schedule-dialog";
import { CustomRequestCard } from "@/components/client/dashboards/custom-request-card";
import { SkeletonRows } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { DegradedPanelsBanner, NotCurrentChip } from "@/components/client/degraded-banner";
import { panelReadiness, panelSignal } from "@/lib/panel-readiness";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toastError } from "@/lib/toast-error";

export const Route = createFileRoute("/_authenticated/client/dashboards")({
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.dashboards.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  head: () => ({
    meta: [
      { title: "Your dashboards — build the view you actually use | TaaSFlow" },
      {
        name: "description",
        content:
          "Compose a dashboard from live hiring blocks: candidates by stage, decisions waiting, time to shortlist, offers, outreach, spend per hire, talent pool and team activity.",
      },
      { property: "og:title", content: "Your dashboards | TaaSFlow" },
      {
        property: "og:description",
        content: "Pick the blocks that matter to you, export them, and have them land in your inbox each week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardsPage,
});

function DashboardsPage() {
  const ctxFn = useServerFn(getClientContext);
  const workspaceFn = useServerFn(getDashboardWorkspace);
  const blocksFn = useServerFn(getDashboardBlocks);
  const orgSearch = useClientOrgSearch();
  const support = useSupportView();
  const queryClient = useQueryClient();

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctx = ctxQuery.data;
  const orgId = ctx?.active?.organization_id as string | undefined;

  const workspaceQuery = useQuery({
    queryKey: ["dashboard-workspace", orgId],
    queryFn: () => workspaceFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const { data: workspace, isLoading } = workspaceQuery;
  const workspaceState = useQueryState(workspaceQuery);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftBlocks, setDraftBlocks] = useState<BlockId[] | null>(null);

  const active = useMemo(() => {
    if (!workspace?.dashboards.length) return null;
    return workspace.dashboards.find((d) => d.id === activeId) ?? workspace.dashboards[0];
  }, [workspace, activeId]);

  const blocks: BlockId[] = draftBlocks ?? active?.blocks ?? DEFAULT_DASHBOARD_BLOCKS;
  const allowed = workspace?.entitlement.allowed ?? false;
  const canEdit = (workspace?.canEdit ?? false) && !support.readOnly;

  const blocksQuery = useQuery({
    queryKey: ["dashboard-blocks", orgId, blocks.join(",")],
    queryFn: () => blocksFn({ data: { orgId: orgId!, blocks } }),
    enabled: !!orgId && allowed && blocks.length > 0,
  });
  const { data: blockData, isFetching: blocksLoading } = blocksQuery;

  // One readiness summary across the three queries feeding this page.
  const readiness = panelReadiness([
    panelSignal("Workspace access", ctxQuery),
    panelSignal("Dashboard settings", workspaceQuery),
    panelSignal("Dashboard figures", blocksQuery),
  ]);
  const blocksNotCurrent = readiness.isNotCurrent("Dashboard figures");

  const saveFn = useServerFn(saveDashboard);
  const save = useMutation({
    mutationFn: (input: { id?: string; name: string; blocks: BlockId[]; isDefault?: boolean }) =>
      saveFn({ data: { orgId: orgId!, ...input } }),
    onSuccess: (res) => {
      if ("error" in res) return toast.error(res.error);
      toast.success("Dashboard saved.");
      setDraftBlocks(null);
      setActiveId(res.id);
      queryClient.invalidateQueries({ queryKey: ["dashboard-workspace", orgId] });
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't save. Nothing was saved — please try again." }),
  });

  if (ctxQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <QueryErrorCard
          error={ctxQuery.error}
          onRetry={() => ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      </div>
    );
  }

  if (workspaceState.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <QueryErrorCard
          error={workspaceState.error}
          onRetry={workspaceState.retry}
          retrying={workspaceState.retrying}
        />
      </div>
    );
  }

  if (isLoading || !workspace) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your dashboards</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Build the view you actually check each morning. Every number links back to the records
            behind it.
          </p>
        </div>
        {allowed && (
          <div className="flex items-center gap-2">
            <ExportMenu orgId={orgId!} blocks={blocks} name={active?.name ?? "Dashboard"} />
            {canEdit && (
              <ScheduleDialog orgId={orgId!} dashboardId={active?.id ?? null} />
            )}
          </div>
        )}
      </header>

      <DegradedPanelsBanner retrying={readiness.retrying} panels={readiness.signals} />

      {!allowed ? (
        <LockedPanel
          reason={formatEnumLabel(workspace.entitlement.reason)}
          openRequest={workspace.openRequest}
          orgId={orgId!}
          canRequest={canEdit}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {workspace.dashboards.map((d) => (
              <Button
                key={d.id}
                size="sm"
                variant={active?.id === d.id ? "default" : "outline"}
                onClick={() => {
                  setActiveId(d.id);
                  setDraftBlocks(null);
                }}
              >
                {d.name}
                {d.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
              </Button>
            ))}
            {canEdit && (
              <AddBlockMenu
                current={blocks}
                onAdd={(id) => setDraftBlocks([...blocks, id])}
              />
            )}
            {canEdit && draftBlocks && (
              <SaveDraft
                existingName={active?.name}
                onSave={(name) =>
                  save.mutate({
                    id: active?.id,
                    name,
                    blocks: draftBlocks,
                    isDefault: workspace.dashboards.length === 0 ? true : undefined,
                  })
                }
                onCancel={() => setDraftBlocks(null)}
                saving={save.isPending}
              />
            )}
          </div>

          {blocksNotCurrent && !blocksQuery.isError && (
            <div className="flex items-center gap-2">
              <NotCurrentChip reason={readiness.reasonFor("Dashboard figures")} />
              <span className="text-xs text-muted-foreground">
                Figures below are out of date — refresh before relying on them.
              </span>
            </div>
          )}

          {blocksQuery.isError ? (
            <QueryErrorCard
              error={blocksQuery.error}
              onRetry={() => blocksQuery.refetch()}
              retrying={blocksQuery.isFetching}
            />
          ) : (
            <div className="grid grid-cols-12 gap-4">
              {blocks.map((id) => (
                <DashboardBlock
                  key={id}
                  definition={BLOCK_LIBRARY[id]}
                  result={blockData?.results.find((r) => r.id === id)}
                  loading={blocksLoading && !blockData}
                  onRemove={
                    canEdit && blocks.length > 1
                      ? () => setDraftBlocks(blocks.filter((b) => b !== id))
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {canEdit && (
            <CustomRequestCard orgId={orgId!} openRequest={workspace.openRequest} />
          )}
        </>
      )}
    </div>
  );
}
