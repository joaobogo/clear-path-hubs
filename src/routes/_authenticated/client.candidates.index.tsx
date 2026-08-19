import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { loadCompareSelection, saveCompareSelection, clearCompareSelection } from "@/lib/client-compare-store";

import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { getClientCandidates } from "@/lib/client-candidates.functions";
import { getClientContext } from "@/lib/client-context.functions";
import { getClientOverview } from "@/lib/client-overview.functions";
import { getClientPositions } from "@/lib/client-positions.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { orgGate, panelState, useStuckAfter } from "@/lib/client/panel-gate";
import { withQueryTimeout } from "@/lib/client/query-timeout";
import { VisibilityNote } from "@/components/client/visibility-note";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CompareTray, CompareSheet } from "@/components/client/candidate-comparison";
import {
  compareEligibility,
  defaultCompareSelection,
  COMPARE_MAX,
} from "@/lib/client-compare";
import { QueryErrorCard } from "@/components/client/query-error";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import { filterAndSortCandidates } from "@/lib/client-candidate-list-filter";
import { UNICORN_SCORE } from "@/lib/scoring/bands";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { STAGE_OPTIONS, FIT_OPTIONS, CRITICAL_OPTIONS, REVIEW_OPTIONS } from "@/components/client/candidates/constants";
import { HiringSnapshot } from "@/components/client/candidates/hiring-snapshot";
import { CandidatesFiltersPanel } from "@/components/client/candidates/filters-panel";
import { CandidatesEmptyState } from "@/components/client/candidates/candidates-empty-state";
import { CompactList } from "@/components/client/candidates/compact-list";
import { BulkCvDownloadButton } from "@/components/client/candidates/bulk-cv-download";
import { CandidatesBoardView } from "@/components/client/candidates/board-view";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
import { plural } from "@/lib/format/plural";

const searchSchema = z.object({
 q: fallback(z.string(), "").default(""),
 position: fallback(z.string(), "").default(""),
 stage: fallback(z.string(), "all").default("all"),
 fit: fallback(z.string(), "all").default("all"),
 critical: fallback(z.string(), "all").default("all"),
 // Unfiltered by default: a filtered-by-default list made "All candidates"
 // links look broken. "Awaiting your review" is one click away as a chip.
 review: fallback(z.string(), "all").default("all"),
 availability: fallback(z.string(), "all").default("all"),
 minExp: fallback(z.string(), "").default(""),
 location: fallback(z.string(), "").default(""),
 sort: fallback(z.string(), "score").default("score"),
 view: fallback(z.enum(["cards", "list", "compare", "board"]), "cards").default("cards"),
 org: fallback(z.string().uuid().optional(), undefined),
 // Canonical KPI drill-through key. Mirrors client-kpi.server predicates:
 // "top" → isTopMatch (band ∈ exceptional|top|strong)
 // "interview_pipeline" → isInInterview (stage ∈ interview_process|offer OR active interview)
 filter: fallback(z.enum(["all", "top", "interview_pipeline"]), "all").default("all"),
  // Unicorn-only shortcut: candidates at or above 95.
  // Rule lives in scoring/bands.ts.
 unicorn: fallback(z.string(), "0").default("0"),
 // Comma-separated match IDs for shareable comparison links.
 compare: fallback(z.string(), "").default(""),
});



const RoutePending = makeWorkspacePending({ shape: "rows", kpis: true, width: "7xl" });
export const Route = createFileRoute("/_authenticated/client/candidates/")({
	pendingMs: 150,
	pendingComponent: RoutePending,
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.candidates.index.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
 validateSearch: zodValidator(searchSchema),
 head: () => ({
 meta: [
 { title: "Candidates · Client workspace" },
 { name: "robots", content: "noindex" },
 ],
 }),
 component: CandidatesPage,
});

function CandidatesPage() {
 const search = Route.useSearch();
 const navigate = Route.useNavigate();
 const ctxFn = useServerFn(getClientContext);
 const listFn = useServerFn(getClientCandidates);
 const overviewFn = useServerFn(getClientOverview);
 const positionsFn = useServerFn(getClientPositions);
 const orgSearch = useClientOrgSearch();

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => withQueryTimeout(ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} })),
  });
  const ctx = ctxQuery.data;
  const orgId = ctx?.active?.organization_id;
  const isSupportView = !!ctx?.isStaff && !!orgSearch;

  const overviewQuery = useQuery({
    queryKey: ["client-overview", orgId],
    queryFn: () => withQueryTimeout(overviewFn({ data: { orgId: orgId! } })),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });
  const { data: overview, isFetching: kpisLoading } = overviewQuery;

 const { data: positions = [] } = useQuery({
 queryKey: ["client-positions-filter", orgId],
 queryFn: () => positionsFn({ data: { orgId: orgId! } }),
 enabled: !!orgId,
 });

 const {
 data: rowsRaw = [],
 isFetching,
 isLoading,
 isError,
 error: rowsError,
 refetch,
 } = useQuery({
 queryKey: ["client-candidates", orgId, search.position, search.stage, search.filter],
 queryFn: () =>
 withQueryTimeout(
 listFn({
 data: { orgId: orgId!, positionId: search.position || undefined },
 }),
 ),
 enabled: !!orgId,
 placeholderData: (prev) => prev,
 });

 useEffect(() => {
 const onRefresh = () => refetch();
 window.addEventListener("client:refresh", onRefresh);
 return () => window.removeEventListener("client:refresh", onRefresh);
 }, [refetch]);

 // The workspace lookup gates the list and the KPI tiles. If it fails, both
 // must show a reason and a Retry — never a skeleton and never a zeroed tile.
 const gate = orgGate(ctxQuery, orgId);
 const hasRows = (rowsRaw as ClientCandidateDTO[]).length > 0;
 const listStuck = useStuckAfter(!hasRows && !gate.failed && !isError);
 const listPanel = panelState({
 gate,
 hasData: hasRows,
 isFetching: isFetching || isLoading,
 isError,
 error: rowsError,
 stuck: listStuck,
 });
 const kpiStuck = useStuckAfter(!overview && !gate.failed && !overviewQuery.isError);
 const kpiPanel = panelState({
 gate,
 hasData: overview !== undefined,
 isFetching: kpisLoading,
 isError: overviewQuery.isError,
 error: overviewQuery.error,
 stuck: kpiStuck,
 });
 const retryAll = () => {
 if (gate.failed) gate.retry();
 void refetch();
 void overviewQuery.refetch();
 };


 // Availability values are derived from the authorized set only — never a fixed
 // list, so the filter can't hint at candidates the client cannot see.
 const availabilityOptions = useMemo(
 () =>
 Array.from(
 new Set(
 (rowsRaw as ClientCandidateDTO[])
 .map((c) => c.candidate.availability?.trim())
 .filter((v): v is string => !!v),
 ),
 ).sort((a, b) => a.localeCompare(b)),
 [rowsRaw],
 );

 // Client-side filter + sort applied to the sanitized DTOs. The predicates
 // live in one tested module so the chips and the KPI drill-throughs cannot
 // drift from the tile definitions.
 const filtered = useMemo(
  () => filterAndSortCandidates(rowsRaw as ClientCandidateDTO[], search),
  [rowsRaw, search],
 );

 // Bounded pagination — clamp render to a fixed page size so no unbounded lists ship.
 const PAGE_SIZE = 24;
 const [page, setPage] = useState(1);
 useEffect(() => {
 setPage(1);
 }, [search.q, search.position, search.stage, search.fit, search.critical, search.review, search.availability, search.minExp, search.location, search.sort, search.filter, search.unicorn, orgId]);
 const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
 const currentPage = Math.min(page, totalPages);
 const paged = filtered.slice(
 (currentPage - 1) * PAGE_SIZE,
 currentPage * PAGE_SIZE,
 );

  // Comparison state — seed from ?compare= (highest priority) or local storage.
  const initialCompare = useMemo(() => {
    if (search.compare) {
      return search.compare
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return orgId ? loadCompareSelection(orgId) : [];
  }, [search.compare, orgId]);

  const [compareIds, setCompareIds] = useState<string[]>(initialCompare);
  const [compareOpen, setCompareOpen] = useState(false); // Controlled by compareIds length/explicit action

  // Sync state to local storage when it changes
  useEffect(() => {
    if (!orgId) return;
    
    // Always sync non-empty selections
    if (compareIds.length > 0) {
      saveCompareSelection(orgId, compareIds);
      return;
    }

    // Only clear storage if we have data (prevents clearing during initial mount/loading)
    // AND it wasn't a seeded default we just haven't confirmed yet.
    const rows = rowsRaw as ClientCandidateDTO[];
    if (rows && rows.length > 0 && seededDefault.current) {
      clearCompareSelection(orgId);
    }
  }, [compareIds, orgId, rowsRaw]);

  const seededDefault = useRef(false);
  useEffect(() => {
    // Pre-select a sensible shortlist for comparison, but never open the grid on
    // its own — the drawer only opens on an explicit ?view=compare or a click.
    if (seededDefault.current) return;
    const rows = rowsRaw as ClientCandidateDTO[];
    if (rows.length === 0) return;
    seededDefault.current = true;

    // If we have an initial selection (from URL or storage), keep it.
    if (initialCompare.length > 0) {
      setCompareIds(initialCompare);
      if (search.view === "compare") setCompareOpen(true);
      return;
    }

    // Only auto-select if no selection exists.
    const scoped = search.position
      ? rows.filter((r) => r.position?.id === search.position)
      : rows;
    const preset = defaultCompareSelection(scoped);
    if (preset.length > 0) {
      setCompareIds(preset);
      if (search.view === "compare") setCompareOpen(true);
    }
  }, [rowsRaw, initialCompare, search.position, search.view]);



  useEffect(() => {
    // Drop any selection that is no longer client-visible (tenant switch, filter change to hidden rows).
    // EXCEPT if we just loaded the page and are initializing from storage/URL.
    if (!rowsRaw || (rowsRaw as ClientCandidateDTO[]).length === 0 || initialCompare.length > 0) return;

    setCompareIds((ids) => {
      if (ids.length === 0) return ids;
      const rows = rowsRaw as ClientCandidateDTO[];
      const next = ids.filter((id) => rows.some((r) => r.match_id === id));
      if (next.length === ids.length && next.every((v, i) => v === ids[i])) return ids;
      return next;
    });
  }, [rowsRaw, orgId]);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      const isSelected = prev.includes(id);
      if (isSelected) return prev.filter((i) => i !== id);
      if (prev.length >= COMPARE_MAX) return prev;
      return [...prev, id];
    });
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds([]);
    setCompareOpen(false);
    if (orgId) {
      clearCompareSelection(orgId);
    }
    // Also clear from local state to ensure it doesn't re-seed
    seededDefault.current = true;
  }, [orgId]);



 const selectedCandidates = useMemo(
 () =>
 compareIds
 .map((id) => (rowsRaw as ClientCandidateDTO[]).find((r) => r.match_id === id))
 .filter(Boolean) as ClientCandidateDTO[],
 [compareIds, rowsRaw],
 );

  // Bulk CV download targets — selection first, else the filtered list.
  // We include all candidates the client can see; the backend enforces staged 
  // redaction (PII stripped) for pre-interview candidates.
  const cvTargets = useMemo(() => {
    const pool =
      selectedCandidates.length > 0 ? selectedCandidates : (filtered as ClientCandidateDTO[]);
    return pool
      .map((c) => ({ matchId: c.match_id, name: c.candidate.display_name }));
  }, [selectedCandidates, filtered]);

 const compareCheck = compareEligibility(selectedCandidates);
 const crossPosition = !compareCheck.ok && selectedCandidates.length >= 2;

 const setF = (patch: Partial<typeof search>) =>
 navigate({ search: { ...search, ...patch } as never });

 // Board edit rights mirror the role board exactly: viewers get a read-only
 // board, and support mode never mutates a client's pipeline.
 const boardCanEdit =
  !isSupportView &&
  (ctx?.active?.role === "client_admin" ||
   ctx?.active?.role === "client_editor" ||
   ctx?.active?.role === "platform_admin" ||
   ctx?.active?.role === "operations");

 const activeFilters = [
 search.position && {
 key: "position",
 // While the role list is still loading we say "this role" — never a UUID.
 label: `Role: ${
 (positions as Array<{ id: string; title: string }>).find((p) => p.id === search.position)?.title ?? "this role"
 }`,
 },
 search.stage !== "all" && {
 key: "stage",
 label: STAGE_OPTIONS.find((s) => s.key === search.stage)?.label,
 },
 search.fit !== "all" && {
 key: "fit",
 label: FIT_OPTIONS.find((s) => s.key === search.fit)?.label,
 },
 search.critical !== "all" && {
 key: "critical",
 label: CRITICAL_OPTIONS.find((o) => o.key === search.critical)?.label,
 },
 search.review !== "all" && {
 key: "review",
 label: REVIEW_OPTIONS.find((o) => o.key === search.review)?.label,
 },
 search.availability !== "all" && {
 key: "availability",
 label: `Availability: ${search.availability}`,
 },
 search.minExp && { key: "minExp", label: `${search.minExp}+ years experience` },
 search.location && { key: "location", label: `Location: ${search.location}` },
 search.q && { key: "q", label: `Search: ${search.q}` },
 search.unicorn === "1" && { key: "unicorn", label: `Unicorn only (${UNICORN_SCORE}+)` },
 ].filter(Boolean) as { key: string; label: string }[];

 const clearFilters = () =>
 navigate({
 search: {
 ...search,
 q: "",
 position: "",
 stage: "all",
 fit: "all",
 critical: "all",
 review: "all",
 availability: "all",
 minExp: "",
 location: "",
 filter: "all",
 unicorn: "0",
 } as never,
 });

 // If the decision-first default hides everything, fall back to all candidates
 // once — a client should never land on an empty list when rows exist.
 const relaxed = useRef(false);
 useEffect(() => {
 if (relaxed.current) return;
 if (search.review !== "awaiting") { relaxed.current = true; return; }
 const rows = rowsRaw as ClientCandidateDTO[];
 if (rows.length === 0) return;
 relaxed.current = true;
 if (!rows.some((c) => c.stage === "delivered")) {
 navigate({ search: { ...search, review: "all" } as never, replace: true });
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [rowsRaw]);

 return (
  <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-28">
 {/* Support-mode banner */}
 {isSupportView && (
 <div className="mb-4 rounded-lg border taas-bd-warning taas-bg-warning-soft px-3 py-2 text-xs taas-fg-warning ">
 Support view · {ctx?.active?.name}. Read-only mirror of the client experience.
 </div>
 )}

 {/* Header */}
 <header className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
 <div className="min-w-0">
 <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Candidates</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Review, compare, and progress the candidates delivered for your open roles.
 </p>
 <VisibilityNote className="mt-2" />
 </div>
 <div className="flex flex-col items-stretch gap-2 sm:shrink-0 sm:items-end">
 <Button
 size="sm"
 onClick={() => setCompareOpen(true)}
 disabled={!compareCheck.ok}
 title={compareCheck.reason ?? undefined}
 >
 Compare {selectedCandidates.length > 0 ? `${selectedCandidates.length} ` : ""}side by side
 </Button>
 {/* Bulk CV download: the ticked candidates when any are selected, else
  every candidate currently shown whose CV has been released. */}
 <BulkCvDownloadButton
  targets={cvTargets}
  label={`Download ${plural(cvTargets.length, "CV", "CVs")} (ZIP)`}
 />
 <div className="text-xs text-muted-foreground sm:text-right">
 <div>
 <span className="tabular-nums text-foreground font-medium">{filtered.length}</span> of{" "}
 {(rowsRaw as ClientCandidateDTO[]).length} shown
 </div>
 {overview?.last_updated && (
 <div>Updated {new Date(overview.last_updated).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE })}</div>
 )}
 <div>Select {2}–{COMPARE_MAX} candidates on one role</div>
 </div>
 </div>
 </header>

 <HiringSnapshot
 overview={overview}
 kpisLoading={kpiPanel.loading}
 isError={kpiPanel.isError}
 error={kpiPanel.error}
 onRetry={retryAll}
 retrying={kpisLoading || gate.retrying}
 orgSearch={orgSearch}
 />


 {/* Action required */}
 {overview?.action_required && overview.action_required.length > 0 && (
 <section aria-label="Action required" className="mb-6 rounded-xl border bg-card p-4">
 <div className="flex items-center justify-between mb-2">
 <h2 className="text-sm font-semibold">Action required</h2>
 <span className="text-xs text-muted-foreground">{overview.action_required.length} pending</span>
 </div>
 <ul className="divide-y">
 {overview.action_required.slice(0, 5).map((a, i) => (
 <li key={i} className="py-2 flex items-center justify-between gap-3">
 <span className="text-sm text-foreground/90 truncate">{a.label}</span>
  <Link
  to={a.label.toLowerCase().includes("offer") ? "/client/candidates" : "/client/interviews"}
  search={(a.label.toLowerCase().includes("offer") ? { stage: "offer", org: orgSearch } : { filter: "interview", org: orgSearch }) as never}
  className="text-xs font-medium text-primary hover:underline shrink-0"
  >
 Open →
 </Link>
 </li>
 ))}
 </ul>
 </section>
 )}

  <CandidatesFiltersPanel
   search={search}
   setF={setF}
   positions={positions as Array<{ id: string; title: string }>}
   availabilityOptions={availabilityOptions}
   activeFilters={activeFilters}
   clearFilters={clearFilters}
   orgId={orgId}
   ctxRole={ctx?.active?.role}
   onApplySavedView={(f) => navigate({ search: { ...search, ...f } as never, replace: true })}
   resultCount={filtered.length}
   totalCount={(rowsRaw as ClientCandidateDTO[]).length}
  />

 {/* Results — loading, failure and "none approved yet" are distinct states */}
  {listPanel.loading ? (
  <div className="rounded-xl border bg-card p-4 space-y-3">
   {Array.from({ length: 6 }).map((_, i) => (
    <Skeleton key={i} className="h-12 w-full rounded-lg" />
   ))}
  </div>
 ) : listPanel.isError ? (
 <QueryErrorCard
  title={gate.noWorkspace ? "No workspace is attached to this account" : "We couldn't load your candidates"}
  error={listPanel.error}
  onRetry={retryAll}
  retrying={isFetching || gate.retrying}
  />
  ) : filtered.length === 0 ? (
  <CandidatesEmptyState
             hasCandidates={(rowsRaw as ClientCandidateDTO[]).length > 0}
             activeFilters={activeFilters}
             onClear={clearFilters}
             orgId={orgId}
             positionId={search.position || undefined}
           />
   ) : search.view === "board" && orgId ? (
            /* Same rows, same filters — only the presentation changes. */
            <CandidatesBoardView
              rows={filtered as ClientCandidateDTO[]}
              orgId={orgId}
              queryKey={["client-candidates", orgId, search.position]}
              canEdit={boardCanEdit}
              refetch={refetch}
            />
   ) : (
            <CompactList
              rows={paged}
              orgId={orgId}
              orgSearch={orgSearch}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
            />
   )}

 {/* Bounded pagination */}
 {search.view !== "board" && filtered.length > PAGE_SIZE && (
 <nav
 aria-label="Candidates pagination"
 className="mt-4 flex items-center justify-between gap-3 text-sm"
 >
 <div className="text-xs text-muted-foreground tabular-nums">
 Showing {(currentPage - 1) * PAGE_SIZE + 1}–
 {Math.min(currentPage * PAGE_SIZE, filtered.length)} of{" "}
 {filtered.length}
 </div>
 <div className="flex items-center gap-2">
 <Button
 size="sm"
 variant="outline"
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 disabled={currentPage <= 1}
 >
 Previous
 </Button>
 <span className="text-xs text-muted-foreground tabular-nums">
 Page {currentPage} of {totalPages}
 </span>
 <Button
 size="sm"
 variant="outline"
 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
 disabled={currentPage >= totalPages}
 >
 Next
 </Button>
 </div>
 </nav>
 )}

 {isFetching && (rowsRaw as ClientCandidateDTO[]).length > 0 && (
 <div className="mt-3 text-xs text-muted-foreground">Refreshing…</div>
 )}

  <CompareTray
   selected={selectedCandidates}
   onClear={clearCompare}
   onOpen={() => setCompareOpen(true)}
   disabledReason={compareCheck.ok ? null : compareCheck.reason}
  />

  <CompareSheet
  open={compareOpen && compareCheck.ok}
  onOpenChange={setCompareOpen}
  candidates={selectedCandidates}
  />

 </div>
 );
}

