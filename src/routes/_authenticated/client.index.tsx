import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getClientContext, getClientOverview } from "@/lib/client.functions";
import { listPendingPaymentRoles } from "@/lib/booking.functions";
import { PaymentGateBanner } from "@/components/client/payment-gate-banner";
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
import { LiveTicker } from "@/components/client/control-room/live-ticker";
import { IntensityDial } from "@/components/client/control-room/intensity-dial";
import { HiringHealthLine } from "@/components/client/hiring-health-line";
import { SystemHealthStrip } from "@/components/client/system-health-strip";
import { AgentActivityRail } from "@/components/client/agent-activity-rail";
import { DecisionQueue } from "@/components/client/decision-queue";
import { NextMilestones, type MilestoneRow } from "@/components/client/next-milestones";
import type { QueueRow } from "@/lib/client-decision-queue";

export const Route = createFileRoute("/_authenticated/client/")({
  head: () => ({
    meta: [{ title: "Overview · Client workspace" }, { name: "robots", content: "noindex" }],
  }),
  component: OverviewPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = 60_000,
    hr = 60 * min,
    day = 24 * hr;
  if (abs < hr) return RELATIVE.format(Math.round(diff / min), "minute");
  if (abs < day) return RELATIVE.format(Math.round(diff / hr), "hour");
  if (abs < 30 * day) return RELATIVE.format(Math.round(diff / day), "day");
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysWaiting(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

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

  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const role = ctx?.active?.role;
  const canSubmit = role === "client_admin" || role === "client_editor";

  const { data, refetch, isFetching, isError } = useQuery({
    queryKey: ["client-overview", orgId],
    queryFn: () => overviewFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });

  const pendingRolesFn = useServerFn(listPendingPaymentRoles);
  const { data: pendingRolesData } = useQuery({
    queryKey: ["client", "pending-payment-roles", orgId],
    queryFn: () => pendingRolesFn({ data: { orgId } }),
    enabled: !!orgId,
  });
  const pendingRoles = pendingRolesData?.roles ?? [];

  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener("client:refresh", onRefresh);
    return () => window.removeEventListener("client:refresh", onRefresh);
  }, [refetch]);

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

      {isError && (
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
              <div className="rounded-lg border taas-bd-warning taas-bg-warning-soft p-6 text-center text-sm">
                We couldn't load your candidates just now.{" "}
                <button
                  onClick={() => refetch()}
                  className="font-medium text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
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

// ═══════════════════════════════════════════════════════════════════════════
// Sections
// ═══════════════════════════════════════════════════════════════════════════

// The queue itself lives in src/components/client/decision-queue.tsx, and its
// ordering rules in src/lib/client-decision-queue.ts.

/**
 * Plain-language stage per role, with the date it entered that stage, how long
 * it has been there, and an "at risk" line derived only from real timing data.
 */
function RoleStatusList({
  roles,
  loading,
  compact,
}: {
  roles: Any[];
  loading: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  }
  if (roles.length === 0) {
    return (
      <EmptyBlock text="No live roles right now. Submit a role and its progress shows up here." />
    );
  }
  return (
    <ul className={compact ? "grid gap-1.5" : "grid gap-2"}>
      {roles.map((r) => {
        const since = formatStageDate(r.stage_entered_at);
        const days = r.days_in_stage as number | null;
        const commitment = shortlistCommitment({
          promisedShortlistBy: r.promised_shortlist_by,
          shortlistDeliveredAt: r.shortlist_delivered_at,
        });
        const next = roleNextStep(r);
        return (
          <li key={r.position_id}>
            <div
              className={`rounded-xl border bg-card transition ${
                r.at_risk ? "taas-bd-warning" : ""
              }`}
            >
              <Link
                to="/client/positions/$id"
                params={{ id: r.position_id }}
                className={`group flex flex-col gap-2 hover:bg-muted/30 ${
                  compact ? "px-4 py-2.5" : "px-4 py-3.5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-semibold group-hover:text-primary">
                        {r.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      <span className="font-medium text-foreground">{r.stage_label}</span>
                      {since ? ` since ${since}` : ""}
                      {days != null
                        ? ` · ${days === 1 ? "1 day" : `${days} days`} in this stage`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.delivered_pending > 0 && (
                      <span className="rounded-full taas-bg-warning-soft px-2 py-0.5 text-[11px] font-semibold taas-fg-warning">
                        {r.delivered_pending} to review
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </div>

                {/* Our promise, next to what actually happened. Misses shown plainly. */}
                {!compact && (
                  <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] sm:text-xs">
                    <div className="min-w-0">
                      <div className="text-muted-foreground">First shortlist promised</div>
                      <div className="truncate font-medium text-foreground">
                        {commitment.promisedAt
                          ? formatCommitmentDate(commitment.promisedAt)
                          : "Not committed"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-muted-foreground">Actual</div>
                      <div className="truncate font-medium text-foreground">
                        {commitment.actualAt
                          ? formatCommitmentDate(commitment.actualAt)
                          : "Not yet"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-muted-foreground">Variance</div>
                      <div
                        className={`truncate font-medium ${
                          commitment.state === "missed" || commitment.state === "overdue"
                            ? "taas-fg-danger"
                            : commitment.state === "met"
                              ? "taas-fg-success"
                              : "text-foreground"
                        }`}
                      >
                        {commitment.varianceLabel}
                      </div>
                    </div>
                  </div>
                )}

                {/* What happens next: owner and date, always stated. */}
                <p
                  className={`flex items-start gap-2 rounded-lg border border-dashed px-3 py-1.5 text-[11px] sm:text-xs ${
                    next.overdue
                      ? "taas-bd-warning taas-bg-warning-soft taas-fg-warning"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <span>
                    <span className="font-semibold text-foreground">Next: </span>
                    {next.sentence}{" "}
                    <span className="font-medium text-foreground">{next.ownerLabel}</span>
                    {next.dateLabel ? ` · by ${next.dateLabel}` : ""}
                  </span>
                </p>

                {r.at_risk && r.risk_reason && (
                  <p className="flex items-start gap-2 rounded-lg taas-bg-warning-soft px-3 py-2 text-xs taas-fg-warning sm:text-sm">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <span className="font-semibold">At risk — </span>
                      {r.risk_reason}
                    </span>
                  </p>
                )}
              </Link>
              <div className="border-t px-4 py-2">
                <Link
                  to="/client/candidates"
                  search={{ position: r.position_id, view: "compare" } as never}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Compare shortlist side by side →
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SinceLastVisit({
  events,
  fallback,
  lastSeen,
}: {
  events: Any[];
  fallback: Any[];
  lastSeen: number | null;
}) {
  const list = events.length ? events : fallback.slice(0, 6);
  const isNew = (e: Any) => lastSeen != null && new Date(e.created_at).getTime() > lastSeen;
  const heading =
    lastSeen && events.length > 0
      ? `Since your last visit · ${events.length} update${events.length === 1 ? "" : "s"}`
      : "Recent activity";
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <SectionHeader icon={<RefreshCw className="h-4 w-4" />} title={heading} size="sm" />
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Hiring activity will appear here as your searches progress.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {list.slice(0, 8).map((e) => (
            <li key={e.id} className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  isNew(e) ? "bg-primary" : "bg-muted-foreground/40"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  {formatAction(String(e.action))}
                  {isNew(e) && (
                    <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      New
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{relTime(e.created_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentMessages({ messages }: { messages: Any[] }) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          icon={<MessageSquare className="h-4 w-4" />}
          title="Recent messages"
          size="sm"
        />
        <Link
          to="/client/conversations"
          className="text-sm font-medium text-primary hover:underline"
        >
          View
        </Link>
      </div>
      {messages.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No recent messages.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {messages.slice(0, 4).map((m) => (
            <li key={m.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">TaaSFlow</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relTime(m.created_at)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared primitives
// ═══════════════════════════════════════════════════════════════════════════

function SectionHeader({
  id,
  icon,
  title,
  action,
  size = "md",
}: {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        id={id}
        className={`flex items-center gap-2 font-semibold tracking-tight ${
          size === "sm" ? "text-sm" : "text-base sm:text-lg"
        }`}
      >
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/40 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function EmptyWelcome({ canSubmit }: { canSubmit: boolean }) {
  return (
    <section className="rounded-xl border bg-card p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">Welcome to your workspace</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Submit your first role and this page becomes a single list of decisions waiting on you —
        candidates to review, interviews to confirm, offers to close.
      </p>
      {canSubmit && (
        <Link to="/intake" className="mt-4 inline-block">
          <Button size="sm" className="min-h-11">
            Submit a role <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      )}
    </section>
  );
}

/** Audit-event actions in client language. Never shows an internal state name. */
function formatAction(action: string): string {
  const map: Record<string, string> = {
    "candidate_match.stage_changed": "A candidate moved forward",
    "client.shortlist": "You shortlisted a candidate",
    "client.request_interview": "You requested an interview",
    "client.offer": "An offer was made",
    "client.hire": "A hire was confirmed",
    "client.not_moving_forward": "A candidate was declined",
    "client.submit_feedback": "Interview feedback was captured",
    "position.approved": "A role was approved",
    "position.activated": "A role went live",
    "position.paused": "A role was paused",
  };
  return map[action] ?? "Your search progressed";
}
