import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getClientContext, getClientOverview } from "@/lib/client.functions";
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

// ─── Priority action queue: dedup + prioritize ──────────────────────────────
// Rule: never show two cards for the same next action. Aggregate by type.
type Priority = {
  type: "offer_pending" | "interview_scheduled" | "new_delivered";
  count: number;
  label: string;
  href: string;
  icon: React.ReactNode;
  cta: string;
};
function buildPriorityQueue(actions: Any[]): Priority[] {
  const offers = actions.find((a) => a.type === "offer_pending");
  const interviews = actions.find((a) => a.type === "interview_scheduled");
  const deliveries = actions.filter((a) => a.type === "new_delivered");
  const deliveryTotal = deliveries.reduce((s, a) => s + (a.count ?? 0), 0);
  const deliveryRoles = deliveries.length;

  const q: Priority[] = [];
  if (offers && offers.count > 0) {
    q.push({
      type: "offer_pending",
      count: offers.count,
      label: `${offers.count} offer${offers.count === 1 ? "" : "s"} awaiting response`,
      href: "/client/candidates?stage=offer",
      icon: <Handshake className="h-4 w-4" />,
      cta: "Follow up",
    });
  }
  if (interviews && interviews.count > 0) {
    q.push({
      type: "interview_scheduled",
      count: interviews.count,
      label: `${interviews.count} interview${interviews.count === 1 ? "" : "s"} to confirm or debrief`,
      href: "/client/interviews",
      icon: <CalendarClock className="h-4 w-4" />,
      cta: "Open interviews",
    });
  }
  if (deliveryTotal > 0) {
    q.push({
      type: "new_delivered",
      count: deliveryTotal,
      label:
        deliveryRoles === 1
          ? deliveries[0].label
          : `${deliveryTotal} new candidate${deliveryTotal === 1 ? "" : "s"} to review across ${deliveryRoles} role${deliveryRoles === 1 ? "" : "s"}`,
      href: "/client/candidates?stage=delivered",
      icon: <Users className="h-4 w-4" />,
      cta: "Review",
    });
  }
  return q;
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
  const actions: Any[] = data?.action_required ?? [];
  const whatsNext: Any[] = data?.whats_next ?? [];
  const latest = data?.latest_candidates ?? [];
  const messages: Any[] = data?.recent_messages ?? [];
  const activity: Any[] = data?.recent_activity ?? [];
  const newThisWeek: number = data?.new_this_week ?? 0;

  const priorityQueue = useMemo(() => buildPriorityQueue(actions), [actions]);
  const hottestRole = useMemo(() => pickHottestRole(whatsNext), [whatsNext]);
  const otherRoles = useMemo(
    () => (whatsNext ?? []).filter((r) => r.position_id !== hottestRole?.position_id),
    [whatsNext, hottestRole],
  );

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
    const parts: string[] = [];
    if (kpis.active_positions) parts.push(`${kpis.active_positions} active search${kpis.active_positions === 1 ? "" : "es"}`);
    const totalPending = priorityQueue.reduce((s, p) => s + p.count, 0);
    if (totalPending > 0) parts.push(`${totalPending} decision${totalPending === 1 ? "" : "s"} waiting`);
    if (parts.length === 0) return "Your workspace is quiet. Submit a role to get started.";
    return `${cap(parts.join(" · "))}.`;
  }, [kpis, priorityQueue]);

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
          {/* 0 · INDUSTRY PERSONALIZATION — vertical-tuned rubric + samples */}
          <IndustryPersonalizationPanel industry={ctx?.active?.industry ?? null} />

          {/* 0.5 · BLOCKING APPROVALS — urgent tasks that hold delivery */}
          {blocking && blocking.count > 0 && (
            <Link
              to="/client/tasks"
              search={{ view: "blocking" }}
              className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm hover:bg-destructive/10"
            >
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="flex-1 font-medium">
                {blocking.count} task{blocking.count === 1 ? "" : "s"} blocking delivery — needs approval or decision
              </span>
              <ArrowRight className="h-4 w-4 text-destructive" />
            </Link>
          )}

          {/* 1 · PRIORITY ACTIONS — what needs me now, deduped */}
          <PriorityActions queue={priorityQueue} loading={!data && isFetching} />


          {/* 2 · HOTTEST ROLE + WEEKLY PROGRESS */}
          <section className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <HottestRoleCard role={hottestRole} />
            </div>
            <div className="lg:col-span-2">
              <WeeklyProgress
                newThisWeek={newThisWeek}
                delivered={kpis?.delivered ?? 0}
                activePositions={kpis?.active_positions ?? 0}
              />
            </div>
          </section>

          {/* 3 · OPEN THIS CANDIDATE FIRST — top-ranked, ready to review */}
          <section aria-labelledby="open-first-heading" className="space-y-3">
            <SectionHeader
              id="open-first-heading"
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title="Open this candidate first"
              action={
                <Link to="/client/candidates" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  All candidates <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {latest.length === 0 ? (
              <EmptyBlock text="Reviewed candidates will appear here when they are ready." />
            ) : (
              <div className="grid gap-3">
                {latest.slice(0, 3).map((c) => (
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

          {/* 5 · SINCE LAST VISIT + RECENT MESSAGES */}
          <section className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <SinceLastVisit events={sinceLastVisit} fallback={activity} lastSeen={lastSeen} />
            </div>
            <div className="lg:col-span-2 grid gap-4">
              <RecentMessages messages={messages} />
              <ActivityFeed organizationId={orgId ?? undefined} limit={8} />
            </div>
          </section>

          {/* 6 · SECONDARY SNAPSHOT — moved below the decision surfaces */}
          <SnapshotFooter kpis={kpis} />

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

function PriorityActions({ queue, loading }: { queue: Priority[]; loading: boolean }) {
  if (loading) {
    return (
      <section aria-labelledby="action-heading">
        <SectionHeader id="action-heading" icon={<AlertTriangle className="h-4 w-4" />} title="What needs you now" />
        <div className="mt-3 h-24 animate-pulse rounded-xl border bg-muted/40" />
      </section>
    );
  }

  if (queue.length === 0) {
    return (
      <section
        aria-labelledby="action-heading"
        className="rounded-xl border bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-5"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full taas-bg-success-soft taas-fg-success">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h2 id="action-heading" className="text-base font-semibold">You are up to date</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No hiring decisions waiting for you. TaaSFlow is continuing work on your active searches.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="action-heading" className="space-y-3">
      <SectionHeader
        id="action-heading"
        icon={<AlertTriangle className="h-4 w-4 taas-fg-warning" />}
        title="What needs you now"
        action={
          <span className="rounded-full taas-bg-warning-soft px-2 py-0.5 text-[11px] font-semibold taas-fg-warning">
            {queue.reduce((s, p) => s + p.count, 0)} to act on
          </span>
        }
      />
      <div className={`grid gap-3 ${queue.length >= 3 ? "md:grid-cols-3" : queue.length === 2 ? "md:grid-cols-2" : ""}`}>
        {queue.map((p) => (
          <Link
            key={p.type}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            to={p.to as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            search={p.search as any}
            className="group relative flex flex-col gap-3 rounded-xl border taas-bd-warning bg-card p-4 transition hover:border-primary/60 hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full taas-bg-warning-soft taas-fg-warning">
                {p.icon}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide taas-fg-warning">
                {p.type === "offer_pending" ? "Offers" : p.type === "interview_scheduled" ? "Interviews" : "New candidates"}
              </span>
            </div>
            <div className="text-[15px] font-semibold leading-snug">{p.label}</div>
            <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span className="font-medium text-primary">{p.cta}</span>
              <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </Link>
        ))}
      </div>
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

function WeeklyProgress({
  newThisWeek,
  delivered,
  activePositions,
}: {
  newThisWeek: number;
  delivered: number;
  activePositions: number;
}) {
  // Rolling target: ~2 candidates per active role per week.
  const target = Math.max(activePositions * 2, 4);
  const pct = target > 0 ? Math.min(100, Math.round((newThisWeek / target) * 100)) : 0;
  return (
    <div className="flex h-full flex-col justify-between rounded-xl border bg-card p-5">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Trophy className="h-3.5 w-3.5" /> This week
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-semibold tabular-nums">{newThisWeek}</span>
          <span className="text-sm text-muted-foreground">
            new candidate{newThisWeek === 1 ? "" : "s"} delivered
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Target ≈ {target} across {activePositions || 0} active role{activePositions === 1 ? "" : "s"}
        </p>
      </div>
      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-primary" : "bg-amber-500"
            }`}
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{pct}% of weekly target</span>
          <span>{delivered.toLocaleString()} lifetime</span>
        </div>
      </div>
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

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
