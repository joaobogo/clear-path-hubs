import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InfoRequestsPanel } from "@/components/client/info-requests";
import { WeeklyUpdateCard } from "@/components/client/weekly-update-card";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getClientContext } from "@/lib/client-context.functions";
import { getClientOverview } from "@/lib/client-overview.functions";
import { listPendingPaymentRoles } from "@/lib/booking.functions";
import { PaymentGateBanner } from "@/components/client/payment-gate-banner";
import { listRolesNeedingDetails } from "@/lib/position-readiness.functions";
import { RoleDetailsNeededBanner } from "@/components/client/role-details-needed-banner";
import { QueryErrorCard } from "@/components/client/query-error";
import { DegradedPanelsBanner, NotCurrentChip } from "@/components/client/degraded-banner";
import { panelReadiness, panelSignal } from "@/lib/panel-readiness";
import { orgGate, panelState, useStuckAfter } from "@/lib/client/panel-gate";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { VisibilityNote } from "@/components/client/visibility-note";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import { SlaScorecard } from "@/components/client/sla-scorecard";
import { DensityToggle } from "@/components/client/density-toggle";
import { useDensity } from "@/lib/use-density";
import { supabase } from "@/integrations/supabase/client";
import { SystemStatusStrip } from "@/components/client/control-room/system-status-strip";
import { LiveTicker } from "@/components/client/control-room/live-ticker";
import { IntensityDial } from "@/components/client/control-room/intensity-dial";
import { HiringHealthLine } from "@/components/client/hiring-health-line";
import { SystemHealthStrip } from "@/components/client/system-health-strip";
import { AgentActivityRail } from "@/components/client/agent-activity-rail";
import { DecisionQueue } from "@/components/client/decision-queue";
import { OpenItemsStrip } from "@/components/client/open-items-strip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { NextMilestones, type MilestoneRow } from "@/components/client/next-milestones";
import type { QueueRow } from "@/lib/client-decision-queue";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { RoleStatusList } from "@/components/client/overview/role-status-list";
import { SinceLastVisit, RecentMessages } from "@/components/client/overview/activity-panels";
import { EmptyWelcome } from "@/components/client/overview/section-primitives";
import { CandidatesReleasedSection } from "@/components/client/overview/candidates-released-section";
import { relTime } from "@/components/client/overview/utils";
import { PAYMENTS_ENABLED } from "@/config/commerce";
import { formatDateTime } from "@/lib/format/datetime";



const RoutePending = makeWorkspacePending({ shape: "kpis", kpis: true, width: "7xl" });
export const Route = createFileRoute("/_authenticated/client/")({
	pendingMs: 150,
	pendingComponent: RoutePending,
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.index.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  head: () => ({
    meta: [{ title: "Overview · Client workspace" }, { name: "robots", content: "noindex" }],
  }),
  component: OverviewPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function OverviewPage() {
  const [selfId, setSelfId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSelfId(data.user?.id ?? null));
  }, []);
  const { density, compact, setDensity } = useDensity(selfId);
  const ctxFn = useServerFn(getClientContext);
  const overviewFn = useServerFn(getClientOverview);
  const orgSearch = useClientOrgSearch();
  const search = useSearch({ strict: false }) as Any;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctx = ctxQuery.data;
  const orgId = ctx?.active?.organization_id;
  const role = ctx?.active?.role;
  const canSubmit = role === "client_admin" || role === "client_editor";

  const overviewQuery = useQuery({
    queryKey: ["client-overview", orgId],
    queryFn: () => overviewFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });
  const { data, refetch, isFetching, isError, error, dataUpdatedAt } = overviewQuery;

  const pendingRolesFn = useServerFn(listPendingPaymentRoles);
  const pendingRolesQuery = useQuery({
    queryKey: ["client", "pending-payment-roles", orgId],
    queryFn: () => pendingRolesFn({ data: { orgId } }),
    enabled: !!orgId && PAYMENTS_ENABLED,
  });
  const pendingRoles = pendingRolesQuery.data?.roles ?? [];


  // Roles that can't be approved yet because the brief is missing details.
  const rolesNeedingDetailsFn = useServerFn(listRolesNeedingDetails);
  const incompleteQuery = useQuery({
    queryKey: ["client", "roles-needing-details", orgId],
    queryFn: () => rolesNeedingDetailsFn({ data: { orgId } }),
    enabled: !!orgId,
  });
  const rolesNeedingDetails = incompleteQuery.data?.roles ?? [];

  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener("client:refresh", onRefresh);
    return () => window.removeEventListener("client:refresh", onRefresh);
  }, [refetch]);

  // The workspace lookup gates every panel below. If it fails, or resolves to
  // no workspace, the dependent queries stay disabled forever — so the gate is
  // reported as a panel failure instead of leaving skeletons on screen.
  const gate = orgGate(ctxQuery, orgId);
  const overviewStuck = useStuckAfter(!data && !gate.failed);
  const overviewPanel = panelState({
    gate,
    hasData: data !== undefined,
    isFetching,
    isError,
    error,
    stuck: overviewStuck,
  });
  const retryAll = () => {
    if (gate.failed) gate.retry();
    void refetch();
  };


  // One readiness summary for the four independent queries on this page.
  const readiness = panelReadiness([
    panelSignal("Workspace access", ctxQuery),
    panelSignal("Pipeline overview", overviewQuery),
    ...(PAYMENTS_ENABLED ? [panelSignal("Roles awaiting payment", pendingRolesQuery)] : []),
    panelSignal("Roles missing details", incompleteQuery),
  ]);

  const pipelineNotCurrent = readiness.isNotCurrent("Pipeline overview");

  const kpis = data?.kpis;
  const roles: Any[] = data?.whats_next ?? [];
  const messages: Any[] = data?.recent_messages ?? [];
  const activity: Any[] = data?.recent_activity ?? [];

  const selectedRole = (search as Any)?.role ?? "";
  const visibleRoles = useMemo(
    () => (selectedRole ? roles.filter((r) => r.position_id === selectedRole) : roles),
    [roles, selectedRole],
  );
  const latest = useMemo(() => {
    const all = data?.latest_candidates ?? [];
    return selectedRole ? all.filter((c: Any) => c.position?.id === selectedRole) : all;
  }, [data, selectedRole]);

  // One queue, built on the server and only filtered by the role picker here.
  const queue: QueueRow[] = useMemo(() => {
    const server: QueueRow[] = ((data as Any)?.decision_queue ?? []) as QueueRow[];
    return selectedRole ? server.filter((q) => q.position_id === selectedRole) : server;
  }, [data, selectedRole]);

  // "Since last visit" — activity newer than the last time this org was viewed.
  const lastSeenKey = orgId ? `client:lastSeen:${orgId}` : null;
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  useEffect(() => {
    if (!lastSeenKey) return;
    const raw = window.localStorage.getItem(lastSeenKey);
    setLastSeen(raw ? Number(raw) : null);
  }, [lastSeenKey]);
  useEffect(() => {
    if (!lastSeenKey || !data) return;
    const t = window.setTimeout(() => {
      window.localStorage.setItem(lastSeenKey, String(Date.now()));
    }, 800);
    return () => window.clearTimeout(t);
  }, [lastSeenKey, data]);
  const sinceLastVisit = useMemo(() => {
    if (!lastSeen) return [] as Any[];
    return activity.filter((e) => new Date(e.created_at).getTime() > lastSeen);
  }, [activity, lastSeen]);

  const showOnboarding = !!kpis && kpis.active_positions === 0 && kpis.delivered === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          {/* The workspace is named once, in the sidebar. This is the page. */}
          <h1 className="truncate text-2xl sm:text-3xl font-semibold tracking-tight">
            Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What is waiting on your decision, and what we do next.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DensityToggle density={density} onChange={setDensity} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["client-overview", orgId] })}
            disabled={isFetching}
            aria-label="Refresh overview"
            className="min-h-11 min-w-11"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          {/* "Create role" already lives in the top bar — one label, one button,
              one place. No second primary action here. */}
        </div>
      </header>

      {/* One aggregate signal for the four independent panels on this page. */}
      <DegradedPanelsBanner retrying={readiness.retrying} panels={readiness.signals} />

      {overviewPanel.isError && (
        <QueryErrorCard
          title={gate.noWorkspace ? "No workspace is attached to this account" : "We couldn't load your overview"}
          error={overviewPanel.error}
          onRetry={retryAll}
          retrying={isFetching || gate.retrying}
        />
      )}

      {isError && data && (
        <div className="flex items-center gap-3 rounded-lg border taas-bd-warning taas-bg-warning-soft px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 taas-fg-warning" />
          <span className="flex-1">
            Overview could not be refreshed. Showing the latest confirmed information.
          </span>
          <button onClick={() => refetch()} className="font-medium text-primary hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Blocking gaps come first — before onboarding, health, or the queue */}
      <RoleDetailsNeededBanner roles={rolesNeedingDetails} />

      {showOnboarding ? (
        <EmptyWelcome canSubmit={canSubmit} />
      ) : (
        <>
          {/* 0 · Roles that can't publish yet — stated plainly, never nagging */}
          {PAYMENTS_ENABLED && pendingRoles.length > 0 && (
            <div className="space-y-3">
              {pendingRoles.map((r) => (
                <PaymentGateBanner
                  key={r.positionId}
                  positionId={r.positionId}
                  positionTitle={r.title}
                  paymentStatus={r.paymentStatus}
                  callStart={r.callStart}
                />
              ))}
            </div>
          )}

          {/* ── FIRST VIEWPORT: what needs your attention now ── */}
          <div className="space-y-6">
            {/* 1 · WHAT NEEDS ME RIGHT NOW — the one decision block, first */}
            <DecisionQueue
              rows={queue}
              meta={(data as Any)?.decision_queue_meta ?? null}
              loading={overviewPanel.loading}
              isError={overviewPanel.isError}
              onRetry={retryAll}
              orgId={orgId ?? null}
              orgSearch={orgSearch ?? null}
            />

            {/* Anything else still waiting on you, overdue first */}
            <OpenItemsStrip orgId={orgId} />

            {/* Missing brief details block sourcing — answerable in place */}
            <InfoRequestsPanel orgId={orgId} onAnswered={() => refetch()} />

            {/* 2 · PROGRESS — one sentence, three figures */}
            <HiringHealthLine
              notCurrent={pipelineNotCurrent}
              notCurrentReason={readiness.reasonFor("Pipeline overview")}
              health={data?.hiring_health ?? null}
              loading={overviewPanel.loading}
              isError={overviewPanel.isError}
              onRetry={retryAll}
              canSubmit={canSubmit}
              org={orgSearch ?? null}
            />

            {/* 3 · MESSAGES — direct, one-click responses */}
            <RecentMessages messages={messages} loading={overviewPanel.loading} />

            {/* 4 · WHAT HAPPENS NEXT — one milestone per active role */}
            <NextMilestones
              rows={((data as Any)?.next_milestones ?? null) as MilestoneRow[] | null}
              totalRoles={roles.length}
              loading={overviewPanel.loading}
              isError={overviewPanel.isError || Boolean((data as Any)?.next_milestones_failed)}
              onRetry={retryAll}
              org={orgSearch ?? null}
            />
          </div>

          {/* ── BELOW THE FOLD: system detail, controls, filters, context ── */}
          <Collapsible className="space-y-6">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="text-sm font-medium text-foreground">Detail</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  System status, controls, role filters, and history
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              {/* Is the system working, and is what I'm looking at current? */}
              <SystemHealthStrip organizationId={orgId} />

              {/* CONTROL ROOM — what is running, what moved, how hard we work */}
              {orgId && (
                <div className="space-y-4">
                  <SystemStatusStrip orgId={orgId} />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <LiveTicker orgId={orgId} />
                    <IntensityDial orgId={orgId} canEdit={role === "client_admin"} />
                  </div>
                </div>
              )}

              {/* AGENT ACTIVITY — the observable record of work on your roles */}
              <AgentActivityRail organizationId={orgId} className="max-h-[32rem]" />

              {/* Role / agent / status filter row */}
              <div className="flex items-center gap-3 pt-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Where your roles are
                </span>
                {pipelineNotCurrent && (
                  <NotCurrentChip reason={readiness.reasonFor("Pipeline overview")} />
                )}
                <span className="h-px flex-1 bg-border" />
                {roles.length > 1 && (
                  <select
                    aria-label="Filter by role"
                    value={selectedRole}
                    onChange={(e) =>
                      navigate({
                        search: ((prev: Any) => ({
                          ...prev,
                          role: e.target.value || undefined,
                        })) as never,
                      })
                    }
                    className="min-h-9 rounded-md border bg-card px-2 text-xs"
                  >
                    <option value="">All roles ({roles.length})</option>
                    {roles.map((r) => (
                      <option key={r.position_id} value={r.position_id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* ROLE STATUS — plain language, real dates, honest risk */}
              <RoleStatusList roles={visibleRoles} loading={overviewPanel.loading} compact={compact} />

              {/* CANDIDATES WAITING ON YOU */}
              <CandidatesReleasedSection
                orgSearch={orgSearch ?? null}
                selectedRole={selectedRole}
                data={data}
                isFetching={overviewPanel.loading}
                isError={overviewPanel.isError}
                error={overviewPanel.error ?? error}
                refetch={retryAll}
                latest={latest}
              />

              {/* PROMISE VS ACTUAL */}
              <SlaScorecard orgId={orgId} positionId={selectedRole || undefined} />

              {/* WHAT CHANGED + weekly update */}
              <section className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <SinceLastVisit
                    events={sinceLastVisit}
                    fallback={activity}
                    lastSeen={lastSeen}
                    loading={overviewPanel.loading}
                  />
                </div>
                <div className="lg:col-span-2">
                  {orgId && <WeeklyUpdateCard orgId={orgId} />}
                </div>
              </section>

              <VisibilityNote />

              {dataUpdatedAt ? (
                <p className="pt-2 text-xs text-muted-foreground">
                  {/* This line describes THIS read of the data, so it moves with the
                      data — it is not the timestamp of the newest record. */}
                  Read {relTime(new Date(dataUpdatedAt).toISOString())} ·{" "}
                  {formatDateTime(new Date(dataUpdatedAt).toISOString())}
                  {data?.last_updated
                    ? ` · newest activity ${formatDateTime(data.last_updated)}`
                    : ""}
                </p>
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
}

