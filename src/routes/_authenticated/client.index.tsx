import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { getClientContext, getClientOverview } from "@/lib/client.functions";
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
 
 Handshake,
 MessageSquare,
 RefreshCw,
 Sparkles,
 Star,
 Trophy,
 Users,
} from "lucide-react";

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
 const isViewer = role === "client_viewer";
 const canSubmit = role === "client_admin" || role === "client_editor";

 const { data, refetch, isFetching, isError } = useQuery({
 queryKey: ["client-overview", orgId],
 queryFn: () => overviewFn({ data: { orgId: orgId! } }),
 enabled: !!orgId,
 // Keep confirmed data visible during background refresh.
 placeholderData: (prev) => prev,
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

 // Derived KPI: offers count (from action_required contract).
 const offersCount = useMemo(
 () => actions.find((a) => a.type === "offer_pending")?.count ?? 0,
 [actions],
 );
 const deliveredPending = useMemo(
 () => actions.filter((a) => a.type === "new_delivered").reduce((s, a) => s + (a.count ?? 0), 0),
 [actions],
 );

 // Factual state summary: "N active searches, N candidates delivered, N decisions waiting."
 const summary = useMemo(() => {
 if (!kpis) return null;
 const parts: string[] = [];
 if (kpis.active_positions) parts.push(`${kpis.active_positions} active search${kpis.active_positions === 1 ? "" : "es"}`);
 if (kpis.delivered) parts.push(`${kpis.delivered} candidate${kpis.delivered === 1 ? "" : "s"} delivered`);
 if (actions.length) parts.push(`${actions.length} decision${actions.length === 1 ? "" : "s"} waiting for your review`);
 if (parts.length === 0) return "Your workspace is quiet. Submit a role to get started.";
 if (parts.length === 1) return `${cap(parts[0])}.`;
 return `${cap(parts.slice(0, -1).join(", "))} and ${parts[parts.length - 1]}.`;
 }, [kpis, actions.length]);

 // Interviews & upcoming milestones (derived, Client-safe).
 const upcoming = useMemo(() => {
 const items: Array<{ icon: React.ReactNode; label: string; href: string; tone: "amber" | "sky" | "emerald" }> = [];
 const iv = actions.find((a) => a.type === "interview_scheduled");
 if (iv) items.push({ icon: <CalendarClock className="h-4 w-4" />, label: iv.label, href: iv.href, tone: "sky" });
 if (offersCount > 0) {
 items.push({
 icon: <Handshake className="h-4 w-4" />,
 label: `${offersCount} offer${offersCount === 1 ? "" : "s"} awaiting response`,
 href: `/client/candidates?filter=interview`,
 tone: "amber",
 });
 }
 return items;
 }, [actions, offersCount]);

 const showOnboarding = !!kpis && kpis.active_positions === 0 && kpis.delivered === 0;

 return (
 <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
 {/* ─────────────── 1. CLIENT HEADER ─────────────── */}
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
          {/* ─────────────── 1. ACTION REQUIRED ─────────────── */}
          <ActionRequired actions={actions} isViewer={!!isViewer} loading={!data && isFetching} />

          {/* ─────────────── 2. HIRING SNAPSHOT ─────────────── */}
          <HiringSnapshot kpis={kpis} deliveredPending={deliveredPending} offers={kpis?.offers ?? offersCount} />

          {/* ─────────────── 3. NEWEST RANKED CANDIDATES ─────────────── */}
          <section aria-labelledby="delivered-heading" className="space-y-3">
            <SectionHeader
              id="delivered-heading"
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              title="Newest ranked candidates"
              action={
                <Link to="/client/candidates" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  View all candidates <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {latest.length === 0 ? (
              <EmptyBlock text="Reviewed candidates will appear here when they are ready." />
            ) : (
              <div className="grid gap-3">
                {latest.slice(0, 6).map((c) => (
                  <CandidateCard key={c.match_id} candidate={c} />
                ))}
              </div>
            )}
          </section>

          {/* ─────────────── 4. ROLE PROGRESS ─────────────── */}
          <section aria-labelledby="role-progress-heading" className="space-y-3">
            <SectionHeader
              id="role-progress-heading"
              icon={<Briefcase className="h-4 w-4" />}
              title="Role progress"
              action={
                <Link to="/client/positions" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  All positions <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            {whatsNext.length === 0 ? (
              <EmptyBlock text={canSubmit ? "Submit your first position to start building your pipeline." : "No active searches yet."} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {whatsNext.slice(0, 4).map((p) => (
                  <PositionCard key={p.position_id} p={p} />
                ))}
              </div>
            )}
          </section>

          {/* ─────────────── 5. UPCOMING INTERVIEWS ─────────────── */}
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-heading" className="space-y-3">
              <SectionHeader
                id="upcoming-heading"
                icon={<CalendarClock className="h-4 w-4" />}
                title="Upcoming interviews"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {upcoming.map((u, i) => (
                  <Link
                    key={i}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    to={u.href as any}
                    className={`group flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary/60 hover:bg-muted/40 ${
                      u.tone === "amber"
                        ? "taas-bd-warning taas-bg-warning-solid/[0.03]"
                        : "taas-bd-info taas-bg-info-solid/[0.03]"
                    }`}
                  >
                    <span className={u.tone === "amber" ? "taas-fg-warning" : "taas-fg-info"}>{u.icon}</span>
                    <span className="flex-1 text-sm">{u.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ─────────────── 6. CANDIDATE MOVEMENT + LIVE ACTIVITY ─────────────── */}
          <section className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <RecentActivity events={activity} />
            </div>
            <div className="lg:col-span-2">
              <RecentMessages messages={messages} />
            </div>
          </section>

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

function ActionRequired({
 actions,
 isViewer,
 loading,
}: {
 actions: Any[];
 isViewer: boolean;
 loading: boolean;
}) {
 if (loading) {
 return (
 <section aria-labelledby="action-heading">
 <SectionHeader id="action-heading" icon={<AlertTriangle className="h-4 w-4" />} title="Action required" />
 <div className="mt-3 h-20 animate-pulse rounded-lg border bg-muted/40" />
 </section>
 );
 }

 if (actions.length === 0) {
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
 There are no hiring decisions waiting for your review. TaaSFlow is continuing work on your active searches.
 </p>
 </div>
 </div>
 </section>
 );
 }

 return (
 <section aria-labelledby="action-heading" className="rounded-xl border taas-bd-warning taas-bg-warning-solid/[0.03] p-4 sm:p-5">
 <div className="flex items-center justify-between gap-3">
 <h2 id="action-heading" className="flex items-center gap-2 text-base font-semibold">
 <AlertTriangle className="h-4 w-4 taas-fg-warning" />
 Action required
 <span className="rounded-full taas-bg-warning-soft px-2 py-0.5 text-xs font-medium taas-fg-warning ">
 {actions.length}
 </span>
 </h2>
 </div>
 <ul className="mt-3 divide-y divide-amber-500/15">
 {actions.map((a, i) => (
 <li key={i}>
 <Link
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 to={a.href as any}
 className="group flex items-center gap-3 py-3 transition hover:text-primary"
 aria-disabled={isViewer && a.type !== "new_delivered" ? undefined : undefined}
 >
 <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full taas-bg-warning-soft taas-fg-warning ">
 {a.type === "offer_pending" ? (
 <Handshake className="h-4 w-4" />
 ) : a.type === "interview_scheduled" ? (
 <CalendarClock className="h-4 w-4" />
 ) : (
 <Users className="h-4 w-4" />
 )}
 </span>
 <span className="min-w-0 flex-1 text-sm">{a.label}</span>
 <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
 </Link>
 </li>
 ))}
 </ul>
 </section>
 );
}

function HiringSnapshot({
 kpis,
 deliveredPending,
 offers,
}: {
 kpis: Any;
 deliveredPending: number;
 offers: number;
}) {
 return (
 <section aria-labelledby="snapshot-heading" className="space-y-3">
 <SectionHeader id="snapshot-heading" icon={<Trophy className="h-4 w-4" />} title="Hiring snapshot" />
 {/* Primary tiles */}
 <div className="grid gap-3 sm:grid-cols-3">
 <PrimaryKpi
 label="Active positions"
 value={kpis?.active_positions}
 href="/client/positions"
 icon={<Briefcase className="h-4 w-4" />}
 />
 <PrimaryKpi
 label="Candidates delivered"
 value={kpis?.delivered}
 href="/client/candidates"
 icon={<Users className="h-4 w-4" />}
 hint={deliveredPending > 0 ? `${deliveredPending} waiting for your review` : "All reviewed"}
 />
 <PrimaryKpi
 label="Awaiting your review"
 value={deliveredPending}
 href="/client/candidates"
 hrefSearch={{ stage: "delivered" }}
 icon={<AlertTriangle className="h-4 w-4" />}
 tone="amber"
 />
 </div>
 {/* Secondary tiles */}
 <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
 <SecondaryKpi label="Top matches" value={kpis?.top} href="/client/candidates" hrefSearch={{ filter: "top" }} icon={<Star className="h-3 w-3" />} />
 <SecondaryKpi label="Shortlisted" value={kpis?.shortlisted} href="/client/candidates" hrefSearch={{ stage: "shortlisted" }} />
 <SecondaryKpi label="Interview process" value={kpis?.interviewing} href="/client/candidates" hrefSearch={{ filter: "interview_pipeline" }} />
 <SecondaryKpi label="Scheduled interviews" value={kpis?.interview_scheduled} href="/client/interviews" hrefSearch={{ status: "scheduled" }} />
 <SecondaryKpi label="Offers" value={kpis?.offers ?? offers} href="/client/candidates" hrefSearch={{ stage: "offer" }} />
 <SecondaryKpi label="Hires" value={kpis?.hires} href="/client/candidates" hrefSearch={{ stage: "hired" }} tone="emerald" />
 </div>
 </section>
 );
}

function PositionCard({ p }: { p: Any }) {
 return (
 <Link
 to="/client/positions/$id"
 params={{ id: p.position_id }}
 className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm"
 >
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <div className="truncate text-[15px] font-semibold group-hover:text-primary">{p.title}</div>
 <div className="mt-0.5 text-xs capitalize text-muted-foreground">{p.status}</div>
 </div>
 {p.delivered_pending > 0 && (
 <span className="shrink-0 rounded-full taas-bg-warning-soft px-2 py-0.5 text-[11px] font-medium taas-fg-warning ">
 {p.delivered_pending} to review
 </span>
 )}
 </div>
 <div className="text-sm text-muted-foreground">{progressPhrase(p)}</div>
 <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs">
 <span className="text-muted-foreground">
 Next: <span className="font-medium text-foreground">{p.next}</span>
 </span>
 <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
 </div>
 </Link>
 );
}

function RecentActivity({ events }: { events: Any[] }) {
 return (
 <div className="rounded-xl border bg-card p-4 sm:p-5">
 <SectionHeader icon={<RefreshCw className="h-4 w-4" />} title="Recent hiring activity" size="sm" />
 {events.length === 0 ? (
 <p className="mt-3 text-sm text-muted-foreground">Hiring activity will appear here as your searches progress.</p>
 ) : (
 <ul className="mt-3 space-y-2.5">
 {events.slice(0, 8).map((e) => (
 <li key={e.id} className="flex items-start gap-3">
 <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
 <div className="min-w-0 flex-1">
 <div className="text-sm">{formatAction(String(e.action))}</div>
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
 View messages
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

function PrimaryKpi({
 label,
 value,
 href,
 hrefSearch,
 icon,
 hint,
 tone,
}: {
 label: string;
 value: number | undefined;
 href: string;
 hrefSearch?: Record<string, string>;
 icon?: React.ReactNode;
 hint?: string;
 tone?: "amber";
}) {
 const display = typeof value === "number" ? value.toLocaleString() : "—";
 const toneCls =
 tone === "amber" && (value ?? 0) > 0
 ? "taas-bd-warning taas-bg-warning-solid/[0.04] hover:taas-bd-warning"
 : "hover:border-primary/50 hover:shadow-sm";
 return (
 <Link
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 to={href as any}
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 search={hrefSearch as any}
 className={`group block rounded-xl border bg-card p-4 transition ${toneCls}`}
 aria-label={`${label}: ${display}`}
 >
 <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
 {icon}
 <span>{label}</span>
 </div>
 <div className="mt-2 text-3xl font-semibold tabular-nums">{display}</div>
 {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
 </Link>
 );
}

function SecondaryKpi({
 label,
 value,
 href,
 hrefSearch,
 icon,
 tone,
}: {
 label: string;
 value: number | undefined;
 href: string;
 hrefSearch?: Record<string, string>;
 icon?: React.ReactNode;
 tone?: "emerald";
}) {
 const display = typeof value === "number" ? value.toLocaleString() : "—";
 const emphasis =
 tone === "emerald" && (value ?? 0) > 0
 ? "taas-fg-success "
 : "text-foreground";
 return (
 <Link
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 to={href as any}
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 search={hrefSearch as any}
 className="group block rounded-lg border bg-card px-3 py-2.5 transition hover:border-primary/40 hover:bg-muted/40"
 aria-label={`${label}: ${display}`}
 >
 <div className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
 {icon}
 <span className="truncate">{label}</span>
 </div>
 <div className={`mt-1 text-xl font-semibold tabular-nums ${emphasis}`}>{display}</div>
 </Link>
 );
}

function EmptyBlock({ text }: { text: string }) {
 return (
 <div className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
 {text}
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════════════════
// Language helpers — Client-friendly, factual, never speculative.
// ═══════════════════════════════════════════════════════════════════════════

function progressPhrase(p: Any): string {
 const pending: number = p.delivered_pending ?? 0;
 if (p.status === "paused") return "Search paused.";
 if (p.status === "draft" || p.status === "approved") return "TaaSFlow is preparing the search.";
 if (pending > 0) {
 return `${pending} candidate${pending === 1 ? "" : "s"} waiting for your review.`;
 }
 if (p.next === "Offer response") return "Offer is with the candidate.";
 if (p.next === "Interview outcome") return "Interview is in progress.";
 if (p.next === "Send interview requests") return "Shortlist is ready — send interview requests.";
 return "TaaSFlow is preparing the next candidate delivery.";
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
