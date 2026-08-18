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
import { QueryErrorCard } from "@/components/client/query-error";
import { withQueryTimeout } from "@/lib/client/query-timeout";
import {
  PortfolioSnapshot,
  CompactList,
  EmptyState,
  type Row,
} from "@/components/client/position-list/position-cards";
import {
  ActionRequiredBanner,
  StatusTabs,
  FilterBar,
  ActiveChips,
} from "@/components/client/position-list/toolbar";

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
 { title: "Roles · Client workspace" },
 { name: "robots", content: "noindex" },
 ],
 }),
 component: PositionsPage,
});


import { SurfaceState } from "@/components/ds/surface-state";
import { resolveFilteredEmptyState } from "@/lib/empty-states/empty-state-catalogue";
import { makeWorkspacePending, WorkspaceRowsSkeleton } from "@/components/workspace/pending-states";
import { Skeleton } from "@/components/ui/skeleton";
import { countRolesByTab, roleStatusTabLabel } from "@/lib/client-role-status-tabs";
import { plural } from "@/lib/format/plural";

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
 queryFn: () => withQueryTimeout(ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} })),
 });
 const ctx = ctxQuery.data;
 const orgId = ctx?.active?.organization_id;
  // One fetch of every role in the workspace: tab filtering and the tab
  // counters come from the same list, so the counters always add up and no
  // status can be missing from every tab.
  const listQuery = useQuery<Row[]>({
    queryKey: ["client-positions", orgId, "all"],
    queryFn: () =>
      withQueryTimeout(listFn({ data: { orgId: orgId! } })) as unknown as Promise<Row[]>,
    enabled: !!orgId,
    // Cached between navigations so returning to Roles renders instantly
    // instead of replaying a multi-second skeleton.
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  });
  const { refetch, isFetching, isError, error } = listQuery;
  const allRows = listQuery.data ?? [];
  // "Resolved once" — not "not fetching". Until this is true the page shows
  // skeletons, never "No results match these filters".
  const hasRoleData = !!listQuery.data && !!orgId;
  const statusCounts = useMemo(() => countRolesByTab(allRows), [allRows]);
  const rows = useMemo(
    () => allRows.filter((p) => {
      const key = p.client_status?.key;
      const tab = key === "active" ? "active" : key === "paused" ? "paused" : key === "closed" ? "closed" : "draft";
      return tab === status;
    }),
    [allRows, status],
  );


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
      // The server already returns a real per-role offer count from the same
      // KPI pass as the others; the tile used to sit at a hardcoded 0, so a
      // role with an offer out still showed "Offers 0".
      acc.offers += p.kpis.offers;
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
 <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
 <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
 <div className="min-w-0">
 <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
 Roles
 </h1>
 <p className="text-sm text-muted-foreground mt-1">
 Roles we are actively hiring for with you.
 </p>
 </div>
 <div className="text-xs text-muted-foreground text-right">
 <div>
  {hasRoleData ? (
    <>
      {plural(rows.length, "role")}
      {status !== "active" ? ` under review` : ""}
    </>
  ) : (
    /* Never a count before the roles list resolves — a zero here reads as
       "you have no roles". */
    <Skeleton className="ml-auto h-3 w-20" />
  )}
 </div>
 {lastUpdated && (
 <div>Last updated {formatRelative(lastUpdated)}</div>
 )}
 </div>
 </header>

 <PortfolioSnapshot data={portfolio} loading={!hasRoleData} />

 <ActionRequiredBanner actionItems={actionItems} />

  <StatusTabs status={status} setSearch={setSearch} counts={hasRoleData ? statusCounts : undefined} />

  <FilterBar
    orgId={orgId}
    ctx={ctx}
    status={status}
    q={q}
    location={location}
    view={view}
    sort={sort}
    locations={locations}
    searchInput={searchInput}
    setSearchInput={setSearchInput}
    setSearch={setSearch}
    navigate={navigate}
  />

  <ActiveChips activeChips={activeChips} clearAll={clearAll} />

 <div className="mb-2 text-xs text-muted-foreground" aria-live="polite">
 {!hasRoleData
 ? "Loading your roles…"
 : isFetching
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
     title="We couldn't load your roles"
     error={error}
     onRetry={() => refetch()}
     retrying={isFetching}
   />
 ) : !hasRoleData ? (
   // Never flash an empty state mid-load: skeletons hold the layout until the
   // roles list has actually resolved once.
   <WorkspaceRowsSkeleton rows={5} />
 ) : rows.length === 0 ? (
 <EmptyState
          status={status}
          hasAnyRole={allRows.length > 0}
          pendingSetup={statusCounts.draft}
        />
 ) : filtered.length === 0 ? (
 <SurfaceState
          content={resolveFilteredEmptyState(activeChips.map((c) => c.label))}
          onAction={clearAll}
        />
 ) : (
 <CompactList rows={filtered} />
 )}
 </div>
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
