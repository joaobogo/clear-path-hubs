import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { getClientContext, getClientPositions } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { SavedViewsBar } from "@/components/workspace/saved-views-bar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Search, AlertCircle, Clock, Briefcase } from "lucide-react";

const searchSchema = z.object({
 status: fallback(z.string(), "active").default("active"),
 q: fallback(z.string(), "").default(""),
 location: fallback(z.string(), "all").default("all"),
 view: fallback(z.enum(["cards", "list"]), "cards").default("cards"),
 sort: fallback(z.string(), "action").default("action"),
 // Drill-through from the hiring health line: roles with no shortlist yet.
 shortlist: fallback(z.enum(["all", "none"]), "all").default("all"),
});

export const Route = createFileRoute("/_authenticated/client/positions/")({
 validateSearch: zodValidator(searchSchema),
 head: () => ({
 meta: [
 { title: "Positions · Client workspace" },
 { name: "robots", content: "noindex" },
 ],
 }),
 component: PositionsPage,
});

const STATUS_TABS = [
 { key: "active", label: "Active" },
 { key: "draft", label: "Under review" },
 { key: "paused", label: "Paused" },
 { key: "closed", label: "Archived" },
] as const;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

import { RoleProgressTracker } from "@/components/client/role-progress-tracker";
import type { RoleProgress } from "@/lib/client-role-progress";
import { SurfaceState } from "@/components/ds/surface-state";
import {
  resolveFilteredEmptyState,
  resolveNoRolesState,
} from "@/lib/empty-states/empty-state-catalogue";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clientRoleStatusLabel,
  type ClientRoleStatus,
} from "@/lib/client-role-status";

type Row = {
 id: string;
 title: string;
 status: string;
 location: string | null;
 work_model: string | null;
 employment_type: string | null;
 seniority: string | null;
 updated_at: string | null;
 kpis: {
 delivered: number;
 top: number;
 shortlisted: number;
 interviewing: number;
 interview_scheduled: number;
 hires: number;
 active_positions: number;
 };
 pipeline_line: string | null;
 progress: RoleProgress | null;
 client_status: ClientRoleStatus | null;
 next_milestone: string | null;
 action_required: string | null;
};


function PositionsPage() {
 const { status, q, location, view, sort, shortlist } = Route.useSearch();
 const navigate = Route.useNavigate();
 const [searchInput, setSearchInput] = useState(q);
 useEffect(() => setSearchInput(q), [q]);
 useEffect(() => {
 const t = setTimeout(() => {
 if (searchInput !== q) {
 navigate({
 search: (prev: Record<string, unknown>) => ({ ...prev, q: searchInput }),
 replace: true,
 });
 }
 }, 250);
 return () => clearTimeout(t);
 }, [searchInput, q, navigate]);

 const ctxFn = useServerFn(getClientContext);
 const listFn = useServerFn(getClientPositions);
 const orgSearch = useClientOrgSearch();
 const { data: ctx } = useQuery({
 queryKey: ["client-context", orgSearch ?? null],
 queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
 });
 const orgId = ctx?.active?.organization_id;
 const {
 data: rows = [],
 refetch,
 isFetching,
 isError,
 error,
 } = useQuery<Row[]>({
 queryKey: ["client-positions", orgId, status],
 queryFn: () =>
     listFn({ data: { orgId: orgId!, status } }) as unknown as Promise<Row[]>,
    enabled: !!orgId,
  });
  // Honest empty-state signals: do any roles exist at all, and how many are
  // still in setup? Only fetched when this view has nothing to show.
  const { data: allRows = [] } = useQuery<Row[]>({
    queryKey: ["client-positions", orgId, "all"],
    queryFn: () => listFn({ data: { orgId: orgId! } }) as unknown as Promise<Row[]>,
    enabled: !!orgId && rows.length === 0,
  });
 useEffect(() => {
 const onRefresh = () => refetch();
 window.addEventListener("client:refresh", onRefresh);
 return () => window.removeEventListener("client:refresh", onRefresh);
 }, [refetch]);

 const locations = useMemo(() => {
 const set = new Set<string>();
 for (const p of rows) if (p.location) set.add(p.location);
 return Array.from(set).sort();
 }, [rows]);

 const filtered = useMemo(() => {
 const term = q.trim().toLowerCase();
 let list = rows.filter((p) => {
 if (location !== "all" && p.location !== location) return false;
 if (shortlist === "none" && p.kpis.delivered > 0) return false;
 if (!term) return true;
 const hay = [p.title, p.location, p.work_model, p.seniority, p.employment_type]
 .filter(Boolean)
 .join(" ")
 .toLowerCase();
 return hay.includes(term);
 });
 list = [...list].sort((a, b) => {
 switch (sort) {
 case "delivered":
 return b.kpis.delivered - a.kpis.delivered;
 case "title":
 return a.title.localeCompare(b.title);
 case "updated":
 return (
 new Date(b.updated_at ?? 0).getTime() -
 new Date(a.updated_at ?? 0).getTime()
 );
 case "action":
 default: {
 const aAct = a.action_required ? 1 : 0;
 const bAct = b.action_required ? 1 : 0;
 if (aAct !== bAct) return bAct - aAct;
 return (
 new Date(b.updated_at ?? 0).getTime() -
 new Date(a.updated_at ?? 0).getTime()
 );
 }
 }
 });
 return list;
 }, [rows, q, location, sort, shortlist]);

 const portfolio = useMemo(() => {
 const acc = {
 active: 0,
 delivered: 0,
 shortlisted: 0,
 interviewing: 0,
 offers: 0,
 hires: 0,
 };
 for (const p of rows) {
 if (["active", "approved"].includes(p.status)) acc.active += 1;
 acc.delivered += p.kpis.delivered;
 acc.shortlisted += p.kpis.shortlisted;
 acc.interviewing += p.kpis.interviewing;
 acc.hires += p.kpis.hires;
 // offers are folded into interviewing on server; keep 0 unless we get a
 // dedicated count later.
 }
 return acc;
 }, [rows]);

 const actionItems = useMemo(
 () => rows.filter((p) => !!p.action_required),
 [rows],
 );

 const lastUpdated = useMemo(() => {
 let latest = 0;
 for (const p of rows) {
 const t = new Date(p.updated_at ?? 0).getTime();
 if (t > latest) latest = t;
 }
 return latest ? new Date(latest) : null;
 }, [rows]);

 const setSearch = (patch: Record<string, string>) =>
 navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }), replace: true });

 const clearAll = () =>
 navigate({
 search: (prev: Record<string, unknown>) => ({ ...prev, q: "", location: "all" }),
 replace: true,
 });

 const activeChips: Array<{ key: string; label: string; onClear: () => void }> = [];
 if (q)
 activeChips.push({
 key: "q",
 label: `“${q}”`,
 onClear: () => setSearch({ q: "" }),
 });
 if (location !== "all")
 activeChips.push({
 key: "loc",
 label: location,
 onClear: () => setSearch({ location: "all" }),
 });

 return (
 <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
 <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
 <div className="min-w-0">
 <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
 Positions
 </h1>
 <p className="text-sm text-muted-foreground mt-1">
 Live hiring projects TaaSFlow is running for your team.
 </p>
 </div>
 <div className="text-xs text-muted-foreground text-right">
 <div>
 {rows.length} position{rows.length === 1 ? "" : "s"}
 {status !== "active" ? ` in ${STATUS_TABS.find((t) => t.key === status)?.label.toLowerCase()}` : ""}
 </div>
 {lastUpdated && (
 <div>Last updated {formatRelative(lastUpdated)}</div>
 )}
 </div>
 </header>

 <PortfolioSnapshot data={portfolio} loading={isFetching && rows.length === 0} />

 {actionItems.length > 0 && (
 <section className="mb-6 rounded-xl border taas-bd-warning taas-bg-warning-soft p-4 ">
 <div className="flex items-center gap-2 mb-3">
 <AlertCircle className="h-4 w-4 taas-fg-warning " />
 <h2 className="text-sm font-semibold">Action required</h2>
 <span className="text-xs text-muted-foreground">
 {actionItems.length} position{actionItems.length === 1 ? "" : "s"}
 </span>
 </div>
 <ul className="space-y-2">
 {actionItems.slice(0, 5).map((p) => (
 <li
 key={p.id}
 className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/60 px-3 py-2 text-sm"
 >
 <div className="min-w-0">
 <div className="font-medium truncate">{p.title}</div>
 <div className="text-xs text-muted-foreground">
 {p.action_required}
 </div>
 </div>
 <Link
 to="/client/positions/$id/edit"
 params={{ id: p.id }}
 search={{ step: undefined }}
 className="text-xs font-medium text-primary hover:underline shrink-0"
 >
 Review →
 </Link>
 </li>
 ))}
 </ul>
 </section>
 )}

 <div className="mb-3 flex flex-wrap items-center gap-1 border-b">
 {STATUS_TABS.map((t) => (
 <button
 key={t.key}
 type="button"
 onClick={() => setSearch({ status: t.key })}
 className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
 status === t.key
 ? "border-primary text-foreground"
 : "border-transparent text-muted-foreground hover:text-foreground"
 }`}
 >
 {t.label}
 </button>
 ))}
 </div>

  <div className="mb-4 flex flex-wrap items-center gap-2">
   <Button asChild size="sm">
    {/* A new role starts from this company's profile — no re-typing. */}
    <Link to="/intake" search={{ carry: "org" }}>New role</Link>
   </Button>
   <SavedViewsBar
    surface="client_positions"
    organizationId={orgId ?? undefined}
    currentFilters={{ status, q, location, view, sort }}
    onApply={(f) =>
     navigate({
      search: (prev: Record<string, unknown>) => ({ ...prev, ...f }),
      replace: true,
     })
    }
    canShare={ctx?.active?.role === "client_admin"}
   />
   <div className="relative flex-1 min-w-[200px] max-w-md">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 value={searchInput}
 onChange={(e) => setSearchInput(e.target.value)}
 placeholder="Search title, location, skills…"
 className="pl-9"
 aria-label="Search positions"
 />
 </div>
 <Select
 value={location}
 onValueChange={(v) => setSearch({ location: v })}
 >
 <SelectTrigger className="w-[160px]" aria-label="Filter by location">
 <SelectValue placeholder="Location" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All locations</SelectItem>
 {locations.map((l) => (
 <SelectItem key={l} value={l}>
 {l}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={sort} onValueChange={(v) => setSearch({ sort: v })}>
 <SelectTrigger className="w-[180px]" aria-label="Sort positions">
 <SelectValue placeholder="Sort" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="action">Action required first</SelectItem>
 <SelectItem value="updated">Recently updated</SelectItem>
 <SelectItem value="delivered">Most candidates</SelectItem>
 <SelectItem value="title">Title (A–Z)</SelectItem>
 </SelectContent>
 </Select>
 <div className="ml-auto inline-flex rounded-md border bg-background p-0.5">
 <Button
 variant={view === "cards" ? "secondary" : "ghost"}
 size="sm"
 className="h-8 px-2"
 aria-label="Card view"
 aria-pressed={view === "cards"}
 onClick={() => setSearch({ view: "cards" })}
 >
 <LayoutGrid className="h-4 w-4" />
 </Button>
 <Button
 variant={view === "list" ? "secondary" : "ghost"}
 size="sm"
 className="h-8 px-2"
 aria-label="List view"
 aria-pressed={view === "list"}
 onClick={() => setSearch({ view: "list" })}
 >
 <List className="h-4 w-4" />
 </Button>
 </div>
 </div>

 {activeChips.length > 0 && (
 <div className="mb-4 flex flex-wrap items-center gap-2">
 {activeChips.map((c) => (
 <button
 key={c.key}
 type="button"
 onClick={c.onClear}
 className="rounded-full border bg-muted/60 px-2.5 py-1 text-xs hover:bg-muted"
 >
 {c.label} ×
 </button>
 ))}
 <button
 type="button"
 onClick={clearAll}
 className="text-xs text-muted-foreground hover:text-foreground"
 >
 Clear all
 </button>
 </div>
 )}

 <div className="mb-2 text-xs text-muted-foreground" aria-live="polite">
 {isFetching
 ? "Refreshing…"
 : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}
 </div>

 {isError && (
 <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
 Could not load positions. {(error as Error)?.message ?? ""}{" "}
 <button
 className="underline"
 onClick={() => refetch()}
 type="button"
 >
 Retry
 </button>
 </div>
 )}

 {rows.length === 0 && !isFetching && !isError ? (
 <EmptyState
          status={status}
          hasAnyRole={allRows.length > 0}
          pendingSetup={allRows.filter((r) => r.status === "draft").length}
        />
 ) : filtered.length === 0 ? (
 <SurfaceState
          content={resolveFilteredEmptyState(activeChips.map((c) => c.label))}
          onAction={clearAll}
        />
 ) : view === "cards" ? (
 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
 {filtered.map((p) => (
 <PositionCard key={p.id} p={p} />
 ))}
 {isFetching &&
 rows.length === 0 &&
 Array.from({ length: 3 }).map((_, i) => (
 <div
 key={i}
 className="h-56 animate-pulse rounded-xl border bg-muted/40"
 />
 ))}
 </div>
 ) : (
 <CompactList rows={filtered} />
 )}
 </main>
 );
}

function PortfolioSnapshot({
 data,
 loading,
}: {
 data: {
 active: number;
 delivered: number;
 shortlisted: number;
 interviewing: number;
 offers: number;
 hires: number;
 };
 loading: boolean;
}) {
 const tiles: Array<{ label: string; value: number; href?: string }> = [
 { label: "Active", value: data.active },
 {
 label: "Delivered",
 value: data.delivered,
 href: "/client/candidates?filter=new",
 },
 {
 label: "Shortlisted",
 value: data.shortlisted,
 href: "/client/candidates?filter=shortlisted",
 },
 {
 label: "Interview",
 value: data.interviewing,
 href: "/client/candidates?filter=interview",
 },
 { label: "Offers", value: data.offers },
 {
 label: "Hires",
 value: data.hires,
 href: "/client/candidates?filter=hired",
 },
 ];
 return (
 <section
 aria-label="Portfolio snapshot"
 className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
 >
 {tiles.map((t) => {
 const inner = (
 <div className="rounded-xl border bg-card p-3 transition-colors hover:border-primary/50">
 <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
 {t.label}
 </div>
 <div className="mt-1 text-2xl font-semibold tabular-nums">
 {loading ? "—" : t.value}
 </div>
 </div>
 );
 return t.href ? (
 <Link key={t.label} to={t.href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
 {inner}
 </Link>
 ) : (
 <div key={t.label}>{inner}</div>
 );
 })}
 </section>
 );
}

function PositionCard({ p }: { p: Row }) {
 const progress = p.pipeline_line ?? progressSummary(p);
 const total =
 p.kpis.delivered +
 p.kpis.shortlisted +
 p.kpis.interviewing +
 p.kpis.hires;
 const segments = [
 { key: "delivered", label: "Delivered", value: p.kpis.delivered, className: "taas-bg-info-soft" },
 { key: "shortlisted", label: "Shortlisted", value: p.kpis.shortlisted, className: "taas-bg-info-soft" },
 { key: "interviewing", label: "Interview", value: p.kpis.interviewing, className: "taas-bg-warning-soft" },
 { key: "hires", label: "Hires", value: p.kpis.hires, className: "taas-bg-success-soft" },
 ];
 return (
 <Link
 to="/client/positions/$id/edit"
 params={{ id: p.id }}
 search={{ step: undefined }}
 className="group flex flex-col gap-3 rounded-xl border bg-card p-5 transition-all hover:border-primary hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <h3 className="font-semibold truncate group-hover:text-primary">
 {p.title}
 </h3>
 <div className="mt-1 text-xs text-muted-foreground truncate">
 {[p.location, p.work_model, p.seniority].filter(Boolean).join(" · ") || "—"}
 </div>
 </div>
 <Badge variant="secondary" className="shrink-0 whitespace-nowrap text-xs">
 {clientRoleStatusLabel(p.client_status)}
 </Badge>
 </div>

 <p className="text-sm text-foreground/80 min-h-[2.5rem]">{progress}</p>
 <RoleProgressTracker progress={p.progress} size="sm" className="pt-1" />

 <div>
 <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
 {total === 0 ? (
 <div className="w-full bg-muted" />
 ) : (
 segments.map((s) =>
 s.value > 0 ? (
 <div
 key={s.key}
 className={s.className}
 style={{ width: `${(s.value / total) * 100}%` }}
 aria-label={`${s.label}: ${s.value}`}
 title={`${s.label}: ${s.value}`}
 />
 ) : null,
 )
 )}
 </div>
 <div className="mt-2 grid grid-cols-4 gap-1 text-[11px]">
 {segments.map((s) => (
 <div key={s.key} className="min-w-0">
 <div className="text-muted-foreground truncate">{s.label}</div>
 <div className="tabular-nums font-medium">{s.value}</div>
 </div>
 ))}
 </div>
 </div>

 <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
 <div className="flex items-center gap-1 text-muted-foreground">
 <Clock className="h-3 w-3" />
 {p.next_milestone ?? "—"}
 </div>
 {p.action_required && (
 <span className="rounded-full taas-bg-warning-soft px-2 py-0.5 taas-fg-warning ">
 {p.action_required}
 </span>
 )}
 </div>
 </Link>
 );
}

function CompactList({ rows }: { rows: Row[] }) {
 return (
 <>
 <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
 <table className="w-full text-sm">
 <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
 <tr>
 <th className="px-4 py-2 text-left">Position</th>
 <th className="px-3 py-2 text-left">Status</th>
 <th className="px-3 py-2 text-left">Location</th>
 <th className="px-3 py-2 text-right">Delivered</th>
 <th className="px-3 py-2 text-right">Shortlist</th>
 <th className="px-3 py-2 text-right">Interview</th>
 <th className="px-3 py-2 text-right">Hires</th>
 <th className="px-3 py-2 text-left">Next</th>
 </tr>
 </thead>
 <tbody>
 {rows.map((p) => (
 <tr
 key={p.id}
 className="border-t hover:bg-muted/30 focus-within:bg-muted/30"
 >
 <td className="px-4 py-2">
 <Link
 to="/client/positions/$id/edit"
 params={{ id: p.id }}
 search={{ step: undefined }}
 className="font-medium hover:underline"
 >
 {p.title}
 </Link>
 <div className="text-xs text-muted-foreground">
 {p.pipeline_line ?? progressSummary(p)}
 </div>
 {p.progress && (
 <div className="mt-1 text-[11px] text-muted-foreground">
 {p.progress.caption}
 </div>
 )}
 {p.action_required && (
 <div className="text-[11px] taas-fg-warning ">
 {p.action_required}
 </div>
 )}

 </td>
 <td className="px-3 py-2">
 <Badge variant="secondary" className="text-[11px]">
 {clientRoleStatusLabel(p.client_status)}
 </Badge>
 </td>
 <td className="px-3 py-2 text-muted-foreground">
 {p.location ?? "—"}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">
 {p.kpis.delivered}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">
 {p.kpis.shortlisted}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">
 {p.kpis.interviewing}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">
 {p.kpis.hires}
 </td>
 <td className="px-3 py-2 text-xs text-muted-foreground">
 {p.next_milestone ?? "—"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <div className="grid gap-3 md:hidden">
 {rows.map((p) => (
 <PositionCard key={p.id} p={p} />
 ))}
 </div>
 </>
 );
}

function EmptyState({
  status,
  hasAnyRole,
  pendingSetup,
}: {
  status: string;
  hasAnyRole: boolean;
  pendingSetup: number;
}) {
  return (
    <SurfaceState content={resolveNoRolesState({ status, hasAnyRole, pendingSetup })} />
  );
}

function progressSummary(p: Row): string {
 if (p.status === "draft") return "Under review by TaaSFlow. You will be notified when the search goes live.";
 if (p.status === "paused") return "This search is currently paused.";
 if (p.status === "closed" || p.status === "archived") return "This search is closed.";
 const k = p.kpis;
 if (k.hires > 0) return `${k.hires} hire${k.hires === 1 ? "" : "s"} confirmed. Hiring activity remains available.`;
 if (k.interviewing > 0)
 return `${k.interviewing} candidate${k.interviewing === 1 ? "" : "s"} in the interview process.`;
 if (k.shortlisted > 0)
 return `${k.shortlisted} shortlisted candidate${k.shortlisted === 1 ? "" : "s"} ready for interview requests.`;
 if (k.delivered > 0)
 return `${k.delivered} candidate${k.delivered === 1 ? "" : "s"} delivered${k.top > 0 ? `, ${k.top} top match${k.top === 1 ? "" : "es"}` : ""}. Waiting on your review.`;
 return "TaaSFlow is building the first shortlist for this role.";
}

function formatRelative(d: Date): string {
 const diff = Date.now() - d.getTime();
 const mins = Math.round(diff / 60000);
 if (mins < 1) return "just now";
 if (mins < 60) return `${mins}m ago`;
 const hrs = Math.round(mins / 60);
 if (hrs < 24) return `${hrs}h ago`;
 const days = Math.round(hrs / 24);
 return `${days}d ago`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _AnyRow = AnyRow;
