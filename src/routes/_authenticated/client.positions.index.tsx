import { createFileRoute, Link } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { getClientContext } from "@/lib/client-context.functions";
import { getClientPositions } from "@/lib/client-positions.functions";
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
import { LayoutGrid, List, Search, AlertCircle } from "lucide-react";
import { QueryErrorCard } from "@/components/client/query-error";
import {
  PortfolioSnapshot,
  PositionCard,
  CompactList,
  EmptyState,
  type Row,
} from "@/components/client/position-list/position-cards";

const searchSchema = z.object({
 status: fallback(z.string(), "active").default("active"),
 q: fallback(z.string(), "").default(""),
 location: fallback(z.string(), "all").default("all"),
 view: fallback(z.enum(["cards", "list"]), "cards").default("cards"),
 sort: fallback(z.string(), "action").default("action"),
 // Drill-through from the hiring health line: roles with no shortlist yet.
 shortlist: fallback(z.enum(["all", "none"]), "all").default("all"),
});


const RoutePending = makeWorkspacePending({ shape: "rows", kpis: true, width: "7xl" });
export const Route = createFileRoute("/_authenticated/client/positions/")({
	pendingMs: 150,
	pendingComponent: RoutePending,
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.positions.index.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
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



import { SurfaceState } from "@/components/ds/surface-state";
import { resolveFilteredEmptyState } from "@/lib/empty-states/empty-state-catalogue";
import { makeWorkspacePending } from "@/components/workspace/pending-states";

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
 const ctxQuery = useQuery({
 queryKey: ["client-context", orgSearch ?? null],
 queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
 });
 const ctx = ctxQuery.data;
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

 {ctxQuery.isError ? (
   <QueryErrorCard
     title="We couldn't load your workspace"
     error={ctxQuery.error}
     onRetry={() => ctxQuery.refetch()}
     retrying={ctxQuery.isFetching}
   />
 ) : isError ? (
   <QueryErrorCard
     title="We couldn't load your positions"
     error={error}
     onRetry={() => refetch()}
     retrying={isFetching}
   />
 ) : rows.length === 0 && !isFetching ? (
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
