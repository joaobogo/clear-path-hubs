import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getClientContext, getClientOverview, getClientTeam } from "@/lib/client.functions";
import { countBlockingTasks } from "@/lib/tasks.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { CandidateCard } from "@/components/client/candidate-card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Flame,
  Handshake,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { IndustryPersonalizationPanel } from "@/components/client/industry-personalization-panel";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export const Route = createFileRoute("/_authenticated/client/")({
  head: () => ({
    meta: [
      { title: "Overview · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
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
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (abs < hr) return RELATIVE.format(Math.round(diff / min), "minute");
  if (abs < day) return RELATIVE.format(Math.round(diff / hr), "hour");
  if (abs < 30 * day) return RELATIVE.format(Math.round(diff / day), "day");
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Decision queue ─────────────────────────────────────────────────────────
// One question: what needs me today? Every row is an action with a real,
// server-computed count and a link straight to where the action happens.
type DecisionRow = {
  key: "awaiting_decision" | "interviews_to_confirm" | "offers_pending" | "blocking_tasks";
  count: number;
  title: string;
  detail: string;
  to: string;
  search?: Record<string, string>;
  icon: React.ReactNode;
  cta: string;
  tone: "warning" | "info" | "danger";
};

function buildDecisionQueue(
  kpis: Any,
  blockingCount: number,
  scope: { org?: string; position?: string } = {},
): DecisionRow[] {
  if (!kpis) return [];
  const base: Record<string, string> = {
    ...(scope.org ? { org: scope.org } : {}),
    ...(scope.position ? { position: scope.position } : {}),
  };
  const rows: DecisionRow[] = [];

  if (blockingCount > 0) {
    rows.push({
      key: "blocking_tasks",
      count: blockingCount,
      title: `${blockingCount} task${blockingCount === 1 ? "" : "s"} blocking delivery`,
      detail: "Approvals and answers we need before candidates can move.",
      to: "/client/tasks",
      search: { view: "blocking" },
      icon: <AlertTriangle className="h-5 w-5" />,
      cta: "Resolve",
      tone: "danger",
    });
  }

  const awaiting = kpis.awaiting_decision ?? 0;
  if (awaiting > 0) {
    rows.push({
      key: "awaiting_decision",
      count: awaiting,
      title: `${awaiting} candidate${awaiting === 1 ? "" : "s"} awaiting your decision`,
      detail: "Delivered to you and not yet shortlisted or declined.",
      to: "/client/candidates",
      search: { ...base, stage: "delivered" },
      icon: <Users className="h-5 w-5" />,
      cta: "Review candidates",
      tone: "warning",
    });
  }

  const toConfirm = kpis.interviews_to_confirm ?? 0;
  if (toConfirm > 0) {
    rows.push({
      key: "interviews_to_confirm",
      count: toConfirm,
      title: `${toConfirm} interview${toConfirm === 1 ? "" : "s"} to confirm`,
      detail: "Requested or being scheduled — a time still needs confirming.",
      to: "/client/interviews",
      search: scope.org ? { org: scope.org } : undefined,
      icon: <CalendarClock className="h-5 w-5" />,
      cta: "Confirm times",
      tone: "info",
    });
  }

  const offers = kpis.offers ?? 0;
  if (offers > 0) {
    rows.push({
      key: "offers_pending",
      count: offers,
      title: `${offers} offer${offers === 1 ? "" : "s"} pending`,
      detail: "Extended and awaiting a candidate response or your close-out.",
      to: "/client/candidates",
      search: { ...base, stage: "offer" },
      icon: <Handshake className="h-5 w-5" />,
      cta: "Follow up",
      tone: "warning",
    });
  }

  return rows;
}

// ─── "Hottest role": position with the most pending reviews, else most recent
function pickHottestRole(whatsNext: Any[]): Any | null {
  if (!whatsNext?.length) return null;
  const active = whatsNext.filter((p) => p.status === "active" || p.status === "approved");
  const pool = active.length ? active : whatsNext;
  return [...pool].sort(
    (a, b) => (b.delivered_pending ?? 0) - (a.delivered_pending ?? 0),
  )[0];
}

function OverviewPage() {
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

  // Blocking tasks — surfaces urgent approvals directly on the overview
  const blockingFn = useServerFn(countBlockingTasks);
  const { data: blocking } = useQuery({
    queryKey: ["client", "blocking-tasks", orgId],
    queryFn: () => blockingFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener("client:refresh", onRefresh);
    return () => window.removeEventListener("client:refresh", onRefresh);
  }, [refetch]);

  const kpis = data?.kpis;
  const whatsNext: Any[] = data?.whats_next ?? [];
  const messages: Any[] = data?.recent_messages ?? [];
  const activity: Any[] = data?.recent_activity ?? [];
  const newThisWeek: number = data?.new_this_week ?? 0;

  // Role focus — preserved in the URL so refresh/deep links keep the selection.
  const selectedRole = (search as Any)?.role ?? "";
  const visibleRoles = useMemo(
    () => (selectedRole ? whatsNext.filter((r) => r.position_id === selectedRole) : whatsNext),
    [whatsNext, selectedRole],
  );
  const latest = useMemo(() => {
    const all = data?.latest_candidates ?? [];
    return selectedRole ? all.filter((c: Any) => c.position?.id === selectedRole) : all;
  }, [data, selectedRole]);

  const decisionQueue = useMemo(
    () => buildDecisionQueue(kpis, blocking?.count ?? 0, { org: orgSearch, position: selectedRole || undefined }),
    [kpis, blocking, orgSearch, selectedRole],
  );
  const hottestRole = useMemo(() => pickHottestRole(visibleRoles), [visibleRoles]);
  const otherRoles = useMemo(
    () => visibleRoles.filter((r) => r.position_id !== hottestRole?.position_id),
    [visibleRoles, hottestRole],
  );

  // Team members and permissions — server enforces who may read this.
  const teamFn = useServerFn(getClientTeam);
  const canViewTeam = role === "client_admin" || role === "client_editor" || !!ctx?.isStaff;
  const { data: team = [] } = useQuery({
    queryKey: ["client-team", orgId],
    queryFn: () => teamFn({ data: { orgId: orgId! } }),
    enabled: !!orgId && canViewTeam,
  });


  // "Since last visit" — activity newer than the last time the user viewed
  // this org's overview. Persist per-org in localStorage.
  const lastSeenKey = orgId ? `client:lastSeen:${orgId}` : null;
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  useEffect(() => {
    if (!lastSeenKey) return;
    const raw = window.localStorage.getItem(lastSeenKey);
    setLastSeen(raw ? Number(raw) : null);
  }, [lastSeenKey]);
  // Mark visit — after activity has rendered.
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

  const summary = useMemo(() => {
    if (!kpis) return null;
    const totalPending = decisionQueue.reduce((s: number, p: DecisionRow) => s + p.count, 0);
    if (totalPending > 0) {
      return `${totalPending} thing${totalPending === 1 ? "" : "s"} need${totalPending === 1 ? "s" : ""} you today.`;
    }
    if (kpis.active_positions) return "Nothing needs you today. Your searches are running.";
    return "Your workspace is quiet. Submit a role to get started.";
  }, [kpis, decisionQueue]);

  const showOnboarding = !!kpis && kpis.active_positions === 0 && kpis.delivered === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Client workspace
          </div>
          <h1 className="mt-1 truncate text-2xl sm:text-3xl font-semibold tracking-tight">
            {ctx?.active?.name ?? "Your organization"}
          </h1>
          {summary && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{summary}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
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

      {isError && (
        <div className="flex items-center gap-3 rounded-lg border taas-bd-warning taas-bg-warning-soft px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 taas-fg-warning" />
          <span className="flex-1">Overview could not be refreshed. Showing the latest confirmed information.</span>
          <button onClick={() => refetch()} className="font-medium text-primary hover:underline">
            Retry
          </button>
        </div>
      )}

      {showOnboarding ? (
        <EmptyWelcome canSubmit={canSubmit} />
      ) : (
        <>
          {/* 1 · THE DECISION QUEUE — the only thing on the first screen */}
          <DecisionQueue queue={decisionQueue} loading={!data && isFetching} />

          {/* ── Everything below here is context, not action ── */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Pipeline detail
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* ROLE FOCUS — multi-position selector, preserved in the URL */}
          {whatsNext.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="role-focus" className="text-xs font-medium text-muted-foreground">
                Role
              </label>
              <select
                id="role-focus"
                value={selectedRole}
                onChange={(e) =>
                  navigate({ search: ((prev: Any) => ({ ...prev, role: e.target.value || undefined })) as never })
                }
                className="min-h-10 rounded-md border bg-card px-3 text-sm"
              >
                <option value="">All active roles ({whatsNext.length})</option>
                {whatsNext.map((r) => (
                  <option key={r.position_id} value={r.position_id}>
                    {r.title}
                  </option>
                ))}
              </select>
              {selectedRole && (
                <button
                  onClick={() => navigate({ search: ((prev: Any) => ({ ...prev, role: undefined })) as never })}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}




          {/* 2 · FOCUS ROLE + NEXT STEPS */}
          <section className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <HottestRoleCard role={hottestRole} />
            </div>
            <div className="lg:col-span-2">
              <NextSteps
                roles={visibleRoles}
                newThisWeek={newThisWeek}
                deliveredTotal={kpis?.delivered ?? 0}
              />
            </div>
          </section>

          {/* 3 · OPEN THIS CANDIDATE FIRST — approved candidates awaiting review */}
          <section aria-labelledby="open-first-heading" className="space-y-3">
            <SectionHeader
              id="open-first-heading"
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title="Approved candidates awaiting review"
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
                <button onClick={() => refetch()} className="font-medium text-primary hover:underline">
                  Try again
                </button>
              </div>
            ) : latest.length === 0 ? (
              <EmptyBlock
                text={
                  selectedRole
                    ? "No candidates approved for this role yet. You'll see them here as soon as they're released to you."
                    : "No candidates approved for you yet. You'll see them here as soon as they're released to you."
                }
              />
            ) : (
              <div className="grid gap-3">
                {latest.slice(0, 3).map((c: Any) => (
                  <CandidateCard key={c.match_id} candidate={c} />
                ))}
              </div>
            )}
          </section>

          {/* 4 · ACTIVE ROLES STRIP — compact health at a glance */}
          {otherRoles.length > 0 && (
            <section aria-labelledby="roles-heading" className="space-y-3">
              <SectionHeader
                id="roles-heading"
                icon={<Briefcase className="h-4 w-4" />}
                title="Other active roles"
                action={
                  <Link to="/client/positions" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    All positions <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <div className="grid gap-2 md:grid-cols-2">
                {otherRoles.slice(0, 4).map((p) => (
                  <RoleRow key={p.position_id} p={p} />
                ))}
              </div>
            </section>
          )}

          {/* 5 · RECENT AUTHORIZED ACTIVITY + MESSAGES */}
          <section className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <SinceLastVisit events={sinceLastVisit} fallback={activity} lastSeen={lastSeen} />
            </div>
            <div className="lg:col-span-2 grid gap-4">
              <RecentMessages messages={messages} />
              <ActivityFeed organizationId={orgId ?? undefined} limit={8} />
            </div>
          </section>

          {/* 6 · TEAM + HELP */}
          <section className="grid gap-4 lg:grid-cols-2">
            {canViewTeam ? (
              <TeamPanel
                members={team as Any[]}
                canManage={role === "client_admin"}
                org={orgSearch}
              />
            ) : (
              <div />
            )}
            <HelpCard org={orgSearch} />
          </section>

          {/* 7 · SECONDARY SNAPSHOT — below every decision surface */}
          <SnapshotFooter kpis={kpis} />

          {/* 8 · INDUSTRY PERSONALIZATION — context, not an action */}
          <IndustryPersonalizationPanel industry={ctx?.active?.industry ?? null} />

          {data?.last_updated && (
            <p className="pt-2 text-xs text-muted-foreground">
              Last updated {relTime(data.last_updated)} · {new Date(data.last_updated).toLocaleString()}
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

/**
 * The decision queue. Every row is an action with a real, server-computed
 * count and a link straight to where that action is taken. Nothing decorative.
 */
function DecisionQueue({ queue, loading }: { queue: DecisionRow[]; loading: boolean }) {
  if (loading) {
    return (
      <section aria-labelledby="queue-heading" className="space-y-3">
        <SectionHeader id="queue-heading" icon={<AlertTriangle className="h-4 w-4" />} title="What needs you today" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      </section>
    );
  }

  if (queue.length === 0) {
    return (
      <section
        aria-labelledby="queue-heading"
        className="rounded-xl border bg-gradient-to-br from-emerald-500/[0.05] to-transparent p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full taas-bg-success-soft taas-fg-success">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h2 id="queue-heading" className="text-lg font-semibold">Nothing needs you today</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No candidates awaiting a decision, no interviews to confirm, no offers pending.
              We'll surface the next decision here the moment it exists.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const total = queue.reduce((s, p) => s + p.count, 0);

  return (
    <section aria-labelledby="queue-heading" className="space-y-3">
      <SectionHeader
        id="queue-heading"
        icon={<AlertTriangle className="h-4 w-4 taas-fg-warning" />}
        title="What needs you today"
        action={
          <span className="rounded-full taas-bg-warning-soft px-2 py-0.5 text-[11px] font-semibold taas-fg-warning">
            {total} to act on
          </span>
        }
      />
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {queue.map((p) => (
          <li key={p.key}>
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={p.to as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              search={p.search as any}
              className="group flex min-h-[76px] items-center gap-4 px-4 py-4 transition hover:bg-muted/40 sm:px-5"
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
                  p.tone === "danger"
                    ? "bg-destructive/10 text-destructive"
                    : p.tone === "info"
                      ? "taas-bg-info-soft taas-fg-info"
                      : "taas-bg-warning-soft taas-fg-warning"
                }`}
              >
                {p.icon}
              </span>
              <span
                className={`w-12 shrink-0 text-3xl font-semibold tabular-nums leading-none ${
                  p.tone === "danger" ? "text-destructive" : "text-foreground"
                }`}
              >
                {p.count}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold leading-snug group-hover:text-primary">
                  {p.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">{p.detail}</span>
              </span>
              <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary sm:inline-flex">
                {p.cta}
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground sm:hidden" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}


function HottestRoleCard({ role }: { role: Any | null }) {
  if (!role) {
    return (
      <div className="flex h-full flex-col justify-center rounded-xl border border-dashed bg-card/40 p-6 text-sm text-muted-foreground">
        No active searches yet. Submit a role to open your first pipeline.
      </div>
    );
  }
  const pending = role.delivered_pending ?? 0;
  const heat = pending >= 3 ? "hot" : pending >= 1 ? "warm" : "steady";
  const heatCls =
    heat === "hot"
      ? "taas-bd-warning taas-bg-warning-solid/[0.04]"
      : heat === "warm"
        ? "taas-bd-info taas-bg-info-solid/[0.03]"
        : "border-border bg-card";

  return (
    <Link
      to="/client/positions/$id"
      params={{ id: role.position_id }}
      className={`group flex h-full flex-col gap-4 rounded-xl border p-5 transition hover:border-primary/60 hover:shadow-sm ${heatCls}`}
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Flame className={`h-3.5 w-3.5 ${heat === "hot" ? "taas-fg-warning" : heat === "warm" ? "taas-fg-info" : ""}`} />
        Hottest role
      </div>
      <div>
        <h3 className="text-xl font-semibold tracking-tight group-hover:text-primary">
          {role.title}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {pending > 0
            ? `${pending} candidate${pending === 1 ? "" : "s"} waiting for your review.`
            : `Next: ${role.next}`}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs">
        <span className="capitalize text-muted-foreground">{role.status}</span>
        <span className="inline-flex items-center gap-1 font-medium text-primary">
          Open role <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Next steps — plain-language expectations. Deliberately not a chart:
 * every line is derived from real authorized records, never a target or
 * a projected number.
 */
function NextSteps({
  roles,
  newThisWeek,
  deliveredTotal,
}: {
  roles: Any[];
  newThisWeek: number;
  deliveredTotal: number;
}) {
  const steps: string[] = [];
  const pending = roles.reduce((s, r) => s + (r.delivered_pending ?? 0), 0);
  if (pending > 0) {
    steps.push(
      `Review ${pending} approved candidate${pending === 1 ? "" : "s"} awaiting your decision.`,
    );
  }
  const awaitingFirst = roles.filter((r) => (r.delivered_pending ?? 0) === 0 && r.next === "Awaiting first candidates");
  if (awaitingFirst.length > 0) {
    steps.push(
      `${awaitingFirst.length} role${awaitingFirst.length === 1 ? " is" : "s are"} still in sourcing — candidates appear here once approved for you.`,
    );
  }
  const interviewing = roles.filter((r) => r.next === "Interview outcome");
  if (interviewing.length > 0) {
    steps.push(`Share interview feedback for ${interviewing.length} role${interviewing.length === 1 ? "" : "s"}.`);
  }
  if (steps.length === 0) {
    steps.push("Nothing is waiting on you. We'll notify you when new candidates are approved.");
  }

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card p-5">
      <SectionHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Next steps" size="sm" />
      <ul className="mt-3 space-y-2.5 text-sm">
        {steps.map((s) => (
          <li key={s} className="flex gap-2.5 leading-relaxed">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t pt-3 text-xs text-muted-foreground tabular-nums">
        {newThisWeek} approved in the last 7 days · {deliveredTotal.toLocaleString()} approved in total
      </div>
    </div>
  );
}

/** Team members and their permissions — only rendered when authorized. */
function TeamPanel({ members, canManage, org }: { members: Any[]; canManage: boolean; org?: string }) {
  const roleLabel = (r: string) =>
    r === "client_admin" ? "Admin — full access" : r === "client_editor" ? "Editor — can decide" : "Viewer — read only";
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader icon={<Users className="h-4 w-4" />} title="Your team" size="sm" />
        {canManage && (
          <Link
            to="/client/team"
            search={(org ? { org } : undefined) as never}
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage
          </Link>
        )}
      </div>
      {members.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No teammates yet.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {members.slice(0, 5).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="min-w-0 truncate text-sm">
                {m.profiles?.full_name ?? m.profiles?.email ?? "Team member"}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{roleLabel(String(m.role))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Clear route to a human. */
function HelpCard({ org }: { org?: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4 sm:p-5">
      <SectionHeader icon={<LifeBuoy className="h-4 w-4" />} title="Need help deciding?" size="sm" />
      <p className="mt-2 text-sm text-muted-foreground">
        Your TaaSFlow team answers questions about any candidate, requirement, or timeline.
      </p>
      <Link
        to="/client/messages"
        search={(org ? { org } : undefined) as never}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Message your team <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function RoleRow({ p }: { p: Any }) {
  const pending = p.delivered_pending ?? 0;
  return (
    <Link
      to="/client/positions/$id"
      params={{ id: p.position_id }}
      className="group flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 transition hover:border-primary/50 hover:bg-muted/40"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold group-hover:text-primary">{p.title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Next: <span className="font-medium text-foreground">{p.next}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {pending > 0 && (
          <span className="rounded-full taas-bg-warning-soft px-2 py-0.5 text-[11px] font-semibold taas-fg-warning">
            {pending}
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
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
        <p className="mt-3 text-sm text-muted-foreground">Hiring activity will appear here as your searches progress.</p>
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
        <SectionHeader icon={<MessageSquare className="h-4 w-4" />} title="Recent messages" size="sm" />
        <Link to="/client/messages" className="text-sm font-medium text-primary hover:underline">
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
                <span className="shrink-0 text-xs text-muted-foreground">{relTime(m.created_at)}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SnapshotFooter({ kpis }: { kpis: Any }) {
  if (!kpis) return null;
  const tiles = [
    { label: "Active positions", value: kpis.active_positions, href: "/client/positions" },
    { label: "Delivered", value: kpis.delivered, href: "/client/candidates" },
    { label: "Top matches", value: kpis.top, href: "/client/candidates", search: { filter: "top" } },
    { label: "Shortlisted", value: kpis.shortlisted, href: "/client/candidates", search: { stage: "shortlisted" } },
    { label: "In interviews", value: kpis.interviewing, href: "/client/candidates", search: { filter: "interview_pipeline" } },
    { label: "Hires", value: kpis.hires, href: "/client/candidates", search: { stage: "hired" }, tone: "emerald" as const },
  ];
  return (
    <section aria-labelledby="snapshot-heading" className="rounded-xl border bg-muted/20 p-4 sm:p-5">
      <SectionHeader id="snapshot-heading" icon={<Trophy className="h-4 w-4" />} title="Pipeline snapshot" size="sm" />
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {tiles.map((t) => (
          <Link
            key={t.label}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            to={t.href as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            search={t.search as any}
            className="group block rounded-lg border bg-card px-3 py-2.5 transition hover:border-primary/40 hover:bg-muted/40"
            aria-label={`${t.label}: ${t.value ?? 0}`}
          >
            <div className="truncate text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
              {t.label}
            </div>
            <div
              className={`mt-1 text-xl font-semibold tabular-nums ${
                t.tone === "emerald" && (t.value ?? 0) > 0 ? "taas-fg-success" : "text-foreground"
              }`}
            >
              {typeof t.value === "number" ? t.value.toLocaleString() : "—"}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EmptyWelcome({ canSubmit }: { canSubmit: boolean }) {
  return (
    <section className="rounded-2xl border bg-gradient-to-br from-primary/[0.06] via-card to-card p-8 sm:p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Welcome to your TaaSFlow workspace</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Submit your first position to start building your candidate pipeline.
      </p>
      {canSubmit && (
        <Link to="/intake" className="mt-5 inline-block">
          <Button size="lg">
            Submit a new position
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Presentation primitives
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
  const H = size === "sm" ? "h3" : "h2";
  return (
    <div className="flex items-center justify-between gap-3">
      <H id={id} className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-foreground/90">
        {icon}
        <span>{title}</span>
      </H>
      {action}
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    "candidate_match.stage_changed": "Candidate stage updated",
    "client.shortlist": "Candidate shortlisted",
    "client.request_interview": "Interview requested",
    "client.offer": "Offer extended",
    "client.hire": "Hire recorded",
    "client.not_moving_forward": "Candidate declined",
    "client.submit_feedback": "Feedback submitted",
    "position.approved": "Position approved",
    "position.activated": "Search activated",
    "position.paused": "Position paused",
  };
  return map[action] ?? action.replace(/[_.]/g, " ");
}
