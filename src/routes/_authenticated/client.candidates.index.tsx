import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
 getClientCandidates,
 getClientContext,
 getClientOverview,
 getClientPositions,
} from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidateCard } from "@/components/client/candidate-card";
import { CompareTray, CompareSheet } from "@/components/client/candidate-comparison";
import { ShareShortlistDialog } from "@/components/client/share-shortlist-dialog";
import { Share2 } from "lucide-react";
import { SavedViewsBar } from "@/components/workspace/saved-views-bar";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

const STAGE_OPTIONS = [
 { key: "all", label: "All stages" },
 { key: "delivered", label: "New — awaiting review" },
 { key: "shortlisted", label: "Shortlisted" },
 { key: "interview_process", label: "Interview process" },
 { key: "offer", label: "Offer" },
 { key: "hired", label: "Hired" },
 { key: "not_moving_forward", label: "Not moving forward" },
] as const;

const FIT_OPTIONS = [
 { key: "all", label: "Any fit" },
 { key: "exceptional", label: "Exceptional" },
 { key: "strong", label: "Strong" },
 { key: "good", label: "Good potential" },
 { key: "mixed", label: "Mixed" },
 { key: "limited", label: "Limited" },
] as const;

const CRITICAL_OPTIONS = [
 { key: "all", label: "Any critical status" },
 { key: "met", label: "All critical requirements met" },
 { key: "gaps", label: "Has critical gaps" },
 { key: "missing_evidence", label: "Missing evidence" },
] as const;

const REVIEW_OPTIONS = [
 { key: "all", label: "Any review status" },
 { key: "awaiting", label: "Awaiting your review" },
 { key: "in_progress", label: "In progress with your team" },
 { key: "closed", label: "Closed" },
] as const;

const SORT_OPTIONS = [
 { key: "recent", label: "Recently delivered" },
 { key: "score", label: "Highest approved fit" },
 { key: "must", label: "Must-have coverage" },
 { key: "stage", label: "Stage" },
 { key: "name", label: "Candidate name" },
] as const;

const searchSchema = z.object({
 q: fallback(z.string(), "").default(""),
 position: fallback(z.string(), "").default(""),
 stage: fallback(z.string(), "all").default("all"),
 fit: fallback(z.string(), "all").default("all"),
 critical: fallback(z.string(), "all").default("all"),
 review: fallback(z.string(), "all").default("all"),
 availability: fallback(z.string(), "all").default("all"),
 minExp: fallback(z.string(), "").default(""),
 location: fallback(z.string(), "").default(""),
 sort: fallback(z.string(), "recent").default("recent"),
 view: fallback(z.enum(["cards", "list"]), "cards").default("cards"),
 org: fallback(z.string().uuid().optional(), undefined),
 // Canonical KPI drill-through key. Mirrors client-kpi.server predicates:
 // "top" → isTopMatch (fit_label ∈ excellent|strong)
 // "interview_pipeline" → isInInterview (stage ∈ interview_process|offer OR active interview)
 filter: fallback(z.enum(["all", "top", "interview_pipeline"]), "all").default("all"),
 // Comma-separated match IDs for shareable comparison links.
 compare: fallback(z.string(), "").default(""),
 // Score range filter (0–100). Empty string = unbounded on that end.
 minScore: fallback(z.string(), "").default(""),
 maxScore: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/client/candidates/")({
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

 const { data: ctx } = useQuery({
 queryKey: ["client-context", orgSearch ?? null],
 queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
 });
 const orgId = ctx?.active?.organization_id;
 const isSupportView = !!ctx?.isStaff && !!orgSearch;

 const { data: overview, isFetching: kpisLoading } = useQuery({
 queryKey: ["client-overview", orgId],
 queryFn: () => overviewFn({ data: { orgId: orgId! } }),
 enabled: !!orgId,
 placeholderData: (prev) => prev,
 });

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
 refetch,
 } = useQuery({
 queryKey: ["client-candidates", orgId, search.position],
 queryFn: () =>
 listFn({
 data: { orgId: orgId!, positionId: search.position || undefined },
 }),
 enabled: !!orgId,
 placeholderData: (prev) => prev,
 });

 useEffect(() => {
 const onRefresh = () => refetch();
 window.addEventListener("client:refresh", onRefresh);
 return () => window.removeEventListener("client:refresh", onRefresh);
 }, [refetch]);

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

 // Client-side filter + sort applied to the sanitized DTOs.
 const filtered = useMemo(() => {
 const q = search.q.trim().toLowerCase();
 const loc = search.location.trim().toLowerCase();
 const rows = (rowsRaw as ClientCandidateDTO[]).filter((c) => {
 // Canonical KPI drill-through — mirrors client-kpi.server predicates.
 if (search.filter === "top") {
 if (c.fit.band !== "exceptional" && c.fit.band !== "strong") return false;
 if (c.score == null) return false;
 } else if (search.filter === "interview_pipeline") {
 if (c.stage !== "interview_process" && c.stage !== "offer") return false;
 }
  if (search.stage !== "all" && c.stage !== search.stage) return false;
  if (search.fit !== "all" && c.fit.band !== search.fit) return false;
  if (search.critical !== "all") {
   const missingEvidence = c.requirement_rows.some(
    (r) => r.importance === "must_have" && r.status === "not_evidenced",
   );
   const gaps = c.coverage.must_total > 0 && c.coverage.must_met < c.coverage.must_total;
   if (search.critical === "met" && (gaps || missingEvidence)) return false;
   if (search.critical === "gaps" && !gaps) return false;
   if (search.critical === "missing_evidence" && !missingEvidence) return false;
  }
  if (search.review !== "all") {
   const group =
    c.stage === "delivered"
     ? "awaiting"
     : c.stage === "hired" || c.stage === "not_moving_forward"
       ? "closed"
       : "in_progress";
   if (group !== search.review) return false;
  }
  if (search.availability !== "all" && (c.candidate.availability ?? "") !== search.availability) return false;
  if (search.minExp) {
   const min = Number(search.minExp);
   if (!Number.isNaN(min) && (c.candidate.years_experience ?? -1) < min) return false;
  }
  const min = search.minScore === "" ? null : Number(search.minScore);
  const max = search.maxScore === "" ? null : Number(search.maxScore);
  if (min != null && !Number.isNaN(min)) {
   if (c.score == null || c.score < min) return false;
  }
  if (max != null && !Number.isNaN(max)) {
   if (c.score == null || c.score > max) return false;
  }
 if (loc && !(c.candidate.location ?? "").toLowerCase().includes(loc)) return false;
 if (q) {
 const hay = [
 c.candidate.display_name,
 c.candidate.headline,
 c.candidate.location,
 c.position?.title,
 ...c.skills,
 ]
 .filter(Boolean)
 .join(" ")
 .toLowerCase();
 if (!hay.includes(q)) return false;
 }
 return true;
 });

 const stageOrder: Record<ClientCandidateDTO["stage"], number> = {
 delivered: 0,
 shortlisted: 1,
 interview_process: 2,
 offer: 3,
 hired: 4,
 not_moving_forward: 5,
 };
 rows.sort((a, b) => {
 switch (search.sort) {
 case "score":
 return (b.score ?? -1) - (a.score ?? -1);
 case "must": {
 const av = a.coverage.must_total
 ? a.coverage.must_met / a.coverage.must_total
 : 0;
 const bv = b.coverage.must_total
 ? b.coverage.must_met / b.coverage.must_total
 : 0;
 return bv - av;
 }
 case "stage":
 return stageOrder[a.stage] - stageOrder[b.stage];
 case "name":
 return a.candidate.display_name.localeCompare(b.candidate.display_name);
 case "recent":
 default: {
 // Prioritise delivered (action required), then most recent.
 const ap = a.stage === "delivered" ? 0 : 1;
 const bp = b.stage === "delivered" ? 0 : 1;
 if (ap !== bp) return ap - bp;
 const at = a.delivered_at ? new Date(a.delivered_at).getTime() : 0;
 const bt = b.delivered_at ? new Date(b.delivered_at).getTime() : 0;
 return bt - at;
 }
 }
 });
 return rows;
 }, [rowsRaw, search.q, search.location, search.stage, search.fit, search.sort, search.filter, search.minScore, search.maxScore]);

 // Bounded pagination — clamp render to a fixed page size so no unbounded lists ship.
 const PAGE_SIZE = 24;
 const [page, setPage] = useState(1);
 useEffect(() => {
 setPage(1);
 }, [search.q, search.position, search.stage, search.fit, search.location, search.sort, search.filter, search.minScore, search.maxScore, orgId]);
 const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
 const currentPage = Math.min(page, totalPages);
 const paged = filtered.slice(
 (currentPage - 1) * PAGE_SIZE,
 currentPage * PAGE_SIZE,
 );

 // Comparison state — seed from ?compare= for shareable links.
 const initialCompare = useMemo(
  () =>
   (search.compare ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [],
 );
 const [compareIds, setCompareIds] = useState<string[]>(initialCompare);
 const [compareOpen, setCompareOpen] = useState(initialCompare.length >= 2);
 const [shareOpen, setShareOpen] = useState(false);
 useEffect(() => {
  // Drop any selection that is no longer client-visible (tenant switch, filter change to hidden rows).
  setCompareIds((ids) => {
   const rows = rowsRaw as ClientCandidateDTO[];
   const next = ids.filter((id) => rows.some((r) => r.match_id === id));
   // Bail out if unchanged to avoid render loops (rowsRaw default `[]` is a fresh ref each render).
   if (next.length === ids.length && next.every((v, i) => v === ids[i])) return ids;
   return next;
  });
 }, [rowsRaw, orgId]);


 const selectedCandidates = useMemo(
 () =>
 compareIds
 .map((id) => (rowsRaw as ClientCandidateDTO[]).find((r) => r.match_id === id))
 .filter(Boolean) as ClientCandidateDTO[],
 [compareIds, rowsRaw],
 );

 const positionsForCompare = new Set(selectedCandidates.map((c) => c.position?.id));
 const crossPosition = positionsForCompare.size > 1;

 const setF = (patch: Partial<typeof search>) =>
 navigate({ search: { ...search, ...patch } as never });

 const activeFilters = [
 search.position && {
 key: "position",
 label: `Position: ${
 (positions as Array<{ id: string; title: string }>).find((p) => p.id === search.position)?.title ?? search.position.slice(0, 8)
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
 label: CRITICAL_OPTIONS.find((s) => s.key === search.critical)?.label,
 },
 search.review !== "all" && {
 key: "review",
 label: REVIEW_OPTIONS.find((s) => s.key === search.review)?.label,
 },
 search.availability !== "all" && {
 key: "availability",
 label: `Availability: ${search.availability}`,
 },
 search.minExp && { key: "minExp", label: `${search.minExp}+ years experience` },
 search.minScore && { key: "minScore", label: `Match ≥ ${search.minScore}` },
 search.maxScore && { key: "maxScore", label: `Match ≤ ${search.maxScore}` },
 search.location && { key: "location", label: `Location: ${search.location}` },
 search.q && { key: "q", label: `Search: ${search.q}` },
 ].filter(Boolean) as { key: string; label: string }[];

 const RESET_TO_ALL = new Set(["stage", "fit", "critical", "review", "availability"]);

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
 minScore: "",
 maxScore: "",
 filter: "all",
 } as never,
 });

 return (
 <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
 {/* Support-mode banner */}
 {isSupportView && (
 <div className="mb-4 rounded-lg border taas-bd-warning taas-bg-warning-soft px-3 py-2 text-xs taas-fg-warning ">
 Support view · {ctx?.active?.name}. Read-only mirror of the client experience.
 </div>
 )}

 {/* Header */}
 <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-6">
 <div className="min-w-0">
 <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Candidates</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Review, compare, and progress the candidates delivered for your open positions.
 </p>
 </div>
 <div className="text-right text-xs text-muted-foreground shrink-0">
 <div>
 <span className="tabular-nums text-foreground font-medium">{filtered.length}</span> of{" "}
 {(rowsRaw as ClientCandidateDTO[]).length} shown
 </div>
 {overview?.last_updated && (
 <div>Updated {new Date(overview.last_updated).toLocaleDateString()}</div>
 )}
 </div>
 </header>

 {/* Hiring snapshot */}
 <section aria-label="Hiring snapshot" className="mb-6">
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
 <SnapshotTile
 label="Delivered"
 value={overview?.kpis.delivered}
 loading={kpisLoading && !overview}
 to="/client/candidates"
 org={orgSearch}
 />
 <SnapshotTile
 label="Top matches"
 value={overview?.kpis.top}
 loading={kpisLoading && !overview}
 to="/client/candidates"
 filter={{ fit: "strong" }}
 org={orgSearch}
 />
 <SnapshotTile
 label="Shortlisted"
 value={overview?.kpis.shortlisted}
 loading={kpisLoading && !overview}
 to="/client/candidates"
 filter={{ stage: "shortlisted" }}
 org={orgSearch}
 />
 <SnapshotTile
 label="Interviewing"
 value={overview?.kpis.interviewing}
 loading={kpisLoading && !overview}
 to="/client/candidates"
 filter={{ stage: "interview_process" }}
 org={orgSearch}
 />
 <SnapshotTile
 label="Offers"
 value={overview?.kpis.offers}
 loading={kpisLoading && !overview}
 to="/client/candidates"
 filter={{ stage: "offer" }}
 org={orgSearch}
 />
 <SnapshotTile
 label="Hires"
 value={overview?.kpis.hires}
 loading={kpisLoading && !overview}
 to="/client/candidates"
 filter={{ stage: "hired" }}
 org={orgSearch}
 />
 </div>
 </section>

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
 to={a.href as never}
 search={(orgSearch ? { org: orgSearch } : undefined) as never}
 className="text-xs font-medium text-primary hover:underline shrink-0"
 >
 Open →
 </Link>
 </li>
 ))}
 </ul>
 </section>
 )}

  {/* Search + filters */}
  <section aria-label="Search and filters" className="mb-4 rounded-xl border bg-card p-3 sm:p-4">
   <div className="mb-3 flex flex-wrap items-center gap-2">
    <SavedViewsBar
     surface="client_candidates"
     organizationId={orgId ?? undefined}
     currentFilters={{
      q: search.q,
      position: search.position,
      stage: search.stage,
      fit: search.fit,
      location: search.location,
      sort: search.sort,
      view: search.view,
      filter: search.filter,
      minScore: search.minScore,
      maxScore: search.maxScore,
     }}
     onApply={(f) => navigate({ search: { ...search, ...f } as never, replace: true })}
     canShare={ctx?.active?.role === "client_admin"}
    />
    <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
     <span className="whitespace-nowrap">Score</span>
     <Input
      className="h-8 w-16"
      type="number"
      inputMode="numeric"
      min={0}
      max={100}
      placeholder="min"
      value={search.minScore}
      onChange={(e) => setF({ minScore: e.target.value })}
      aria-label="Minimum score"
     />
     <span>–</span>
     <Input
      className="h-8 w-16"
      type="number"
      inputMode="numeric"
      min={0}
      max={100}
      placeholder="max"
      value={search.maxScore}
      onChange={(e) => setF({ maxScore: e.target.value })}
      aria-label="Maximum score"
     />
    </div>
   </div>
   <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] gap-2">
 <Input
 placeholder="Search by name, skill, role, location…"
 value={search.q}
 onChange={(e) => setF({ q: e.target.value })}
 aria-label="Search candidates"
 />
 <Select
 value={search.position || "all"}
 onValueChange={(v) => setF({ position: v === "all" ? "" : v })}
 >
 <SelectTrigger aria-label="Position"><SelectValue placeholder="All positions" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All positions</SelectItem>
 {(positions as Array<{ id: string; title: string }>).map((p) => (
 <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={search.stage} onValueChange={(v) => setF({ stage: v })}>
 <SelectTrigger aria-label="Stage"><SelectValue /></SelectTrigger>
 <SelectContent>
 {STAGE_OPTIONS.map((o) => (
 <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={search.fit} onValueChange={(v) => setF({ fit: v })}>
 <SelectTrigger aria-label="Fit"><SelectValue /></SelectTrigger>
 <SelectContent>
 {FIT_OPTIONS.map((o) => (
 <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Input
 placeholder="Location"
 value={search.location}
 onChange={(e) => setF({ location: e.target.value })}
 aria-label="Filter by location"
 />
 <div className="flex items-center gap-2 justify-end">
 <Select value={search.sort} onValueChange={(v) => setF({ sort: v })}>
 <SelectTrigger className="min-w-[10rem]" aria-label="Sort"><SelectValue /></SelectTrigger>
 <SelectContent>
 {SORT_OPTIONS.map((o) => (
 <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <div className="inline-flex rounded-md border p-0.5">
 <button
 onClick={() => setF({ view: "cards" })}
 className={`px-2 py-1 text-xs rounded ${search.view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
 aria-pressed={search.view === "cards"}
 >
 Cards
 </button>
 <button
 onClick={() => setF({ view: "list" })}
 className={`px-2 py-1 text-xs rounded ${search.view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
 aria-pressed={search.view === "list"}
 >
 List
 </button>
 </div>
 </div>
  </div>

  {/* Secondary, permitted dimensions */}
  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
   <Select value={search.critical} onValueChange={(v) => setF({ critical: v })}>
    <SelectTrigger aria-label="Critical requirements"><SelectValue /></SelectTrigger>
    <SelectContent>
     {CRITICAL_OPTIONS.map((o) => (
      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
     ))}
    </SelectContent>
   </Select>
   <Select value={search.availability} onValueChange={(v) => setF({ availability: v })}>
    <SelectTrigger aria-label="Availability"><SelectValue /></SelectTrigger>
    <SelectContent>
     <SelectItem value="all">Any availability</SelectItem>
     {availabilityOptions.map((a) => (
      <SelectItem key={a} value={a}>{a}</SelectItem>
     ))}
    </SelectContent>
   </Select>
   <Select value={search.minExp} onValueChange={(v) => setF({ minExp: v === "all" ? "" : v })}>
    <SelectTrigger aria-label="Minimum experience"><SelectValue placeholder="Any experience" /></SelectTrigger>
    <SelectContent>
     <SelectItem value="all">Any experience</SelectItem>
     <SelectItem value="2">2+ years</SelectItem>
     <SelectItem value="5">5+ years</SelectItem>
     <SelectItem value="8">8+ years</SelectItem>
     <SelectItem value="12">12+ years</SelectItem>
    </SelectContent>
   </Select>
   <Select value={search.review} onValueChange={(v) => setF({ review: v })}>
    <SelectTrigger aria-label="Review status"><SelectValue /></SelectTrigger>
    <SelectContent>
     {REVIEW_OPTIONS.map((o) => (
      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
     ))}
    </SelectContent>
   </Select>
  </div>

 {activeFilters.length > 0 && (
 <div className="mt-3 flex items-center gap-2 flex-wrap">
 {activeFilters.map((f) => (
 <span
 key={f.key}
 className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
 >
 {f.label}
 <button
 onClick={() => setF({ [f.key]: f.key === "stage" || f.key === "fit" ? "all" : "" } as never)}
 className="text-muted-foreground hover:text-foreground"
 aria-label={`Remove ${f.label}`}
 >
 ×
 </button>
 </span>
 ))}
 <Button size="sm" variant="ghost" onClick={clearFilters}>Clear all</Button>
 </div>
 )}
 </section>

 {/* Results — loading, failure and "none approved yet" are distinct states */}
 {isLoading && (rowsRaw as ClientCandidateDTO[]).length === 0 ? (
 <div className="grid gap-3 md:grid-cols-2">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-52 rounded-xl" />
 ))}
 </div>
 ) : isError && (rowsRaw as ClientCandidateDTO[]).length === 0 ? (
 <div className="rounded-xl border taas-bd-warning taas-bg-warning-soft p-10 text-center">
 <div className="text-base font-medium">We couldn't load your candidates.</div>
 <p className="mt-1 text-sm text-muted-foreground">
 This is a temporary problem on our side — your data is unchanged.
 </p>
 <Button size="sm" variant="outline" className="mt-4" onClick={() => refetch()}>
 Try again
 </Button>
 </div>
 ) : filtered.length === 0 ? (
 <EmptyState
 hasCandidates={(rowsRaw as ClientCandidateDTO[]).length > 0}
 activeFilters={activeFilters}
 onClear={clearFilters}
 />
 ) : search.view === "list" ? (
 <CompactList
 rows={paged}
 orgSearch={orgSearch}
 compareIds={compareIds}
 onToggleCompare={(id) => toggleCompare(setCompareIds, id)}
 />
 ) : (
 <div className="grid gap-4 md:grid-cols-2">
 {paged.map((c) => (
 <CandidateCard
 key={c.match_id}
 candidate={c}
 compareSelected={compareIds.includes(c.match_id)}
 compareDisabled={compareIds.length >= 4}
 onToggleCompare={(id) => toggleCompare(setCompareIds, id)}
 />
 ))}
 </div>
 )}

 {/* Bounded pagination */}
 {filtered.length > PAGE_SIZE && (
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
 onClear={() => setCompareIds([])}
 onOpen={() => setCompareOpen(true)}
 disabledReason={
 crossPosition ? "Select candidates from the same position to compare" : null
 }
 />
  <CompareSheet
  open={compareOpen && selectedCandidates.length >= 2 && !crossPosition}
  onOpenChange={setCompareOpen}
  candidates={selectedCandidates}
  />

  {selectedCandidates.length > 0 && (
   <div className="fixed bottom-24 right-6 z-40">
    <Button
     size="lg"
     className="shadow-lg"
     onClick={() => setShareOpen(true)}
     disabled={crossPosition}
     title={crossPosition ? "Select candidates from the same position to share" : undefined}
    >
     <Share2 className="mr-2 h-4 w-4" />
     Share shortlist ({selectedCandidates.length})
    </Button>
   </div>
  )}

  {orgId && (
   <ShareShortlistDialog
    open={shareOpen}
    onOpenChange={setShareOpen}
    orgId={orgId}
    positionId={selectedCandidates[0]?.position?.id ?? null}
    matchIds={selectedCandidates.map((c) => c.match_id)}
    suggestedTitle={
     selectedCandidates[0]?.position?.title
      ? `Shortlist — ${selectedCandidates[0].position.title}`
      : undefined
    }
   />
  )}
 </main>
 );
}

function toggleCompare(
 setter: (fn: (prev: string[]) => string[]) => void,
 id: string,
) {
 setter((prev) => {
 if (prev.includes(id)) return prev.filter((x) => x !== id);
 if (prev.length >= 4) return prev;
 return [...prev, id];
 });
}

function SnapshotTile({
 label,
 value,
 loading,
 to,
 filter,
 org,
}: {
 label: string;
 value: number | undefined;
 loading: boolean;
 to: string;
 filter?: Record<string, string>;
 org?: string;
}) {
 const searchObj = { ...(filter ?? {}), ...(org ? { org } : {}) };
 return (
 <Link
 to={to as never}
 search={Object.keys(searchObj).length ? (searchObj as never) : undefined}
 className="rounded-xl border bg-card p-3 hover:border-primary/40 transition min-h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 >
 <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
 <div className="text-2xl font-semibold tabular-nums mt-1 min-h-[2rem]">
 {loading ? <Skeleton className="h-7 w-10" /> : (value ?? "—")}
 </div>
 </Link>
 );
}

function EmptyState({
 hasCandidates,
 activeFilters,
 onClear,
}: {
 hasCandidates: boolean;
 activeFilters: { key: string; label: string }[];
 onClear: () => void;
}) {
 const filtered = hasCandidates && activeFilters.length > 0;
 return (
 <div className="rounded-xl border bg-card p-10 text-center">
 <div className="text-base font-medium">
 {filtered
 ? "No candidates match the selected filters."
 : hasCandidates
 ? "No candidates to show."
 : "No candidates approved for you yet."}
 </div>
 <div className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
 {filtered ? (
 <>
 These filters removed every result:{" "}
 <span className="font-medium text-foreground">
 {activeFilters.map((f) => f.label).join(" · ")}
 </span>
 </>
 ) : (
 "Your TaaSFlow team is building the pipeline for your roles. Candidates appear here once they're approved for you."
 )}
 </div>
 {filtered && (
 <Button size="sm" variant="outline" className="mt-4" onClick={onClear}>
 Clear all filters
 </Button>
 )}
 </div>
 );
}

function CompactList({
 rows,
 orgSearch,
 compareIds,
 onToggleCompare,
}: {
 rows: ClientCandidateDTO[];
 orgSearch?: string;
 compareIds: string[];
 onToggleCompare: (id: string) => void;
}) {
 return (
 <>
 {/* Mobile: stacked cards */}
 <div className="grid gap-3 md:hidden">
 {rows.map((c) => (
 <CandidateCard
 key={c.match_id}
 candidate={c}
 compareSelected={compareIds.includes(c.match_id)}
 compareDisabled={compareIds.length >= 4}
 onToggleCompare={onToggleCompare}
 />
 ))}
 </div>
 {/* Desktop: table */}
 <div className="hidden md:block overflow-hidden rounded-xl border bg-card">
 <table className="w-full text-sm">
 <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
 <tr>
 <th className="w-8 py-2 px-3"></th>
 <th className="text-left py-2 px-3">Candidate</th>
 <th className="text-left py-2 px-3">Position</th>
 <th className="text-left py-2 px-3">Fit</th>
 <th className="text-left py-2 px-3">Must-haves</th>
 <th className="text-left py-2 px-3">Location</th>
 <th className="text-left py-2 px-3">Stage</th>
 <th className="text-right py-2 px-3">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y">
 {rows.map((c) => (
 <tr key={c.match_id} className="hover:bg-muted/20">
 <td className="py-2 px-3">
 <input
 type="checkbox"
 checked={compareIds.includes(c.match_id)}
 disabled={compareIds.length >= 4 && !compareIds.includes(c.match_id)}
 onChange={() => onToggleCompare(c.match_id)}
 aria-label={`Compare ${c.candidate.display_name}`}
 />
 </td>
 <td className="py-2 px-3">
 <div className="font-medium">{c.candidate.display_name}</div>
 <div className="text-xs text-muted-foreground truncate max-w-xs">
 {c.candidate.headline ?? ""}
 </div>
 </td>
 <td className="py-2 px-3 text-muted-foreground truncate max-w-[12rem]">
 {c.position?.title ?? "—"}
 </td>
 <td className="py-2 px-3">
 <div className="font-medium tabular-nums">
 {c.score == null ? "—" : c.score.toFixed(0)}
 </div>
 <div className="text-xs text-muted-foreground">{c.fit.headline}</div>
 </td>
 <td className="py-2 px-3 tabular-nums">
 {c.coverage.must_met}/{c.coverage.must_total || "—"}
 </td>
 <td className="py-2 px-3 text-muted-foreground">
 {c.candidate.location ?? "—"}
 </td>
 <td className="py-2 px-3 text-muted-foreground capitalize">
 {c.stage.replace(/_/g, " ")}
 </td>
 <td className="py-2 px-3 text-right">
 <Link
 to="/client/candidates/$id"
 params={{ id: c.match_id }}
 search={orgSearch ? { org: orgSearch } : undefined}
 className="text-primary hover:underline text-sm"
 >
 Open →
 </Link>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 );
}
