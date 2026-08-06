import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
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
import { useClientOrgSearch } from "@/lib/use-client-org";
import { CandidateCard } from "@/components/client/candidate-card";
import { VisibilityNote } from "@/components/client/visibility-note";
import { formatStageDate } from "@/lib/client-role-progress";
import { shortlistCommitment, formatCommitmentDate } from "@/lib/client-commitment";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { SlaScorecard } from "@/components/client/sla-scorecard";
import { DensityToggle } from "@/components/client/density-toggle";
import { useDensity } from "@/lib/use-density";
import { roleNextStep } from "@/lib/client-role-next-step";
import { supabase } from "@/integrations/supabase/client";
import { SystemStatusStrip } from "@/components/client/control-room/system-status-strip";
import { clientRoleStatusLabel } from "@/lib/client-role-status";
import { LiveTicker } from "@/components/client/control-room/live-ticker";
import { IntensityDial } from "@/components/client/control-room/intensity-dial";
import { HiringHealthLine } from "@/components/client/hiring-health-line";
import { SystemHealthStrip } from "@/components/client/system-health-strip";
import { AgentActivityRail } from "@/components/client/agent-activity-rail";
import { DecisionQueue } from "@/components/client/decision-queue";
import { OpenItemsStrip } from "@/components/client/open-items-strip";

import { NextMilestones, type MilestoneRow } from "@/components/client/next-milestones";
import type { QueueRow } from "@/lib/client-decision-queue";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { RoleStatusList } from "@/components/client/overview/role-status-list";
import { SinceLastVisit, RecentMessages } from "@/components/client/overview/activity-panels";
import { SectionHeader, EmptyBlock, EmptyWelcome } from "@/components/client/overview/section-primitives";
import { relTime } from "@/components/client/overview/utils";


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
  const { data, refetch, isFetching, isError, error } = overviewQuery;

  const pendingRolesFn = useServerFn(listPendingPaymentRoles);
  const pendingRolesQuery = useQuery({
    queryKey: ["client", "pending-payment-roles", orgId],
    queryFn: () => pendingRolesFn({ data: { orgId } }),
    enabled: !!orgId,
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

  // One readiness summary for the four independent queries on this page.
  const readiness = panelReadiness([
    panelSignal("Workspace access", ctxQuery),
    panelSignal("Pipeline overview", overviewQuery),
    panelSignal("Roles awaiting payment", pendingRolesQuery),
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
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Client workspace
          </div>
          <h1 className="mt-1 truncate text-2xl sm:text-3xl font-semibold tracking-tight">
            {ctx?.active?.name ?? "Your organization"}
          </h1>
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
          {canSubmit && (
            <Link to="/intake">
              <Button size="sm" className="min-h-11">
                <span className="hidden sm:inline">Submit a new position</span>
                <span className="sm:hidden">New role</span>
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Is the system working, and is what I'm looking at current? */}
      <SystemHealthStrip organizationId={orgId} />

      {/* Everything still waiting on you, overdue work first. */}
      <div className="mt-4">
        <OpenItemsStrip orgId={orgId} />
      </div>


      {/* One aggregate signal for the four independent panels on this page. */}
      <DegradedPanelsBanner retrying={readiness.retrying} panels={readiness.signals} />

      {isError && !data && (
        <QueryErrorCard
          title="We couldn't load your overview"
          error={error}
          onRetry={() => refetch()}
          retrying={isFetching}
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
          {pendingRoles.length > 0 && (
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

          {/* 1 · HIRING HEALTH — one sentence, three figures, above the queue */}
          <HiringHealthLine
            notCurrent={pipelineNotCurrent}
            notCurrentReason={readiness.reasonFor("Pipeline overview")}
            health={data?.hiring_health ?? null}
            loading={!data && isFetching}
            isError={isError && !data}
            onRetry={() => refetch()}
            canSubmit={canSubmit}
            org={orgSearch ?? null}
          />

          {/* 3 · WHAT HAPPENS NEXT — one milestone per active role, with dates
              only where a commitment or recorded due date exists */}
          <NextMilestones
            rows={((data as Any)?.next_milestones ?? null) as MilestoneRow[] | null}
            totalRoles={roles.length}
            loading={!data && isFetching}
            isError={(isError && !data) || Boolean((data as Any)?.next_milestones_failed)}
            onRetry={() => refetch()}
            org={orgSearch ?? null}
          />

          {/* 2 · WHAT NEEDS ME TODAY — the only thing on the first screen */}
          <DecisionQueue
            rows={queue}
            meta={(data as Any)?.decision_queue_meta ?? null}
            loading={!data && isFetching}
            isError={isError && !data}
            onRetry={() => refetch()}
            orgId={orgId ?? null}
            orgSearch={orgSearch ?? null}
          />
          {/* Missing brief details block sourcing — answerable in place */}
          <InfoRequestsPanel orgId={orgId} onAnswered={() => refetch()} />

          {/* This week — recorded events only, identical to the weekly email */}
          {orgId && <WeeklyUpdateCard orgId={orgId} />}
          <VisibilityNote />

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

          {/* ── Context below the fold ── */}
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

          {/* 2 · ROLE STATUS — plain language, real dates, honest risk */}
          <RoleStatusList roles={visibleRoles} loading={!data && isFetching} compact={compact} />

          {/* 3 · CANDIDATES WAITING ON YOU */}
          <section aria-labelledby="open-first-heading" className="space-y-3">
            <SectionHeader
              id="open-first-heading"
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title="Candidates released to you"
              action={
                <Link
                  to="/client/candidates"
                  search={
                    {
                      ...(orgSearch ? { org: orgSearch } : {}),
                      ...(selectedRole ? { position: selectedRole } : {}),
                    } as never
                  }
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  All candidates <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {!data && isFetching ? (
              <div className="grid gap-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
                ))}
              </div>
            ) : isError && !data ? (
              <QueryErrorCard
                title="We couldn't load your candidates"
                error={error}
                onRetry={() => refetch()}
                retrying={isFetching}
                compact
              />
            ) : latest.length === 0 ? (
              <EmptyBlock text="No candidates released to you yet. They appear here the moment they're approved for this role." />
            ) : (
              <div className="grid gap-3">
                {latest.slice(0, 3).map((c: Any) => (
                  <CandidateCard key={c.match_id} candidate={c} />
                ))}
              </div>
            )}
          </section>

          {/* 4 · PROMISE VS ACTUAL */}
          <SlaScorecard orgId={orgId} positionId={selectedRole || undefined} />

          {/* 5 · WHAT CHANGED + MESSAGES */}
          <section className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <SinceLastVisit events={sinceLastVisit} fallback={activity} lastSeen={lastSeen} />
            </div>
            <div className="lg:col-span-2">
              <RecentMessages messages={messages} />
            </div>
          </section>

          {data?.last_updated && (
            <p className="pt-2 text-xs text-muted-foreground">
              Last updated {relTime(data.last_updated)} ·{" "}
              {new Date(data.last_updated).toLocaleString()}
            </p>
          )}
        </>
      )}
    </main>
  );
}

