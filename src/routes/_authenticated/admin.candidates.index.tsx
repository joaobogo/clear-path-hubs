import { createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import {
  makeRouteErrorComponent,
  makeRouteNotFoundComponent,
} from "@/components/workspace/route-states";
import { useQuery, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import {
  searchCandidateIndex,
  listCandidateCountries,
  bulkSetClientVisibility,
} from "@/lib/admin-candidates.functions";
import { listOrgOptions, listPositionOptions } from "@/lib/admin.functions";
import { SavedViewsBar } from "@/components/workspace/saved-views-bar";
import { REJECTION_REASONS } from "@/lib/client-decision-reasons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkOpsBar } from "@/components/admin/BulkOpsBar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, ArrowUpDown, X, AlertTriangle, Unlock } from "lucide-react";
import { ErrorState } from "@/components/ds";
import {
  DuplicateCandidatesBanner,
  DuplicateCandidatesPanel,
} from "@/components/admin/duplicate-candidates-panel";
import { ExportControl } from "@/components/admin/export-control";
import { ScoreStalenessChip, freshnessFromRow } from "@/components/admin/score-staleness-chip";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  organization_id: fallback(z.string(), "").default(""),
  position_id: fallback(z.string(), "").default(""),
  stage: fallback(z.string(), "").default(""),
  admin_status: fallback(z.string(), "").default(""),
  processing_state: fallback(z.string(), "").default(""),
  client_visibility: fallback(z.string(), "").default(""),
  eligibility_status: fallback(z.string(), "").default(""),
  score_band: fallback(z.string(), "").default(""),
  confidence: fallback(z.string(), "").default(""),
  contact_released: fallback(z.string(), "").default(""),
  critical: fallback(z.string(), "").default(""),
  country: fallback(z.string(), "").default(""),
  source: fallback(z.string(), "").default(""),
  rejection_reason: fallback(z.string(), "").default(""),
  date_from: fallback(z.string(), "").default(""),
  date_to: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "updated_desc").default("updated_desc"),
  page: fallback(z.number().int(), 1).default(1),
});

type SearchState = z.infer<typeof searchSchema>;

const FILTER_KEYS = [
  "q", "organization_id", "position_id", "stage", "admin_status", "processing_state",
  "client_visibility", "eligibility_status", "score_band", "confidence",
  "contact_released", "critical", "country", "source", "rejection_reason", "date_from", "date_to",
] as const;

const EMPTY_DEFAULTS = Object.fromEntries(FILTER_KEYS.map((k) => [k, ""]));

const SEARCH_DEFAULTS = { ...(EMPTY_DEFAULTS as Record<string, string>), sort: "updated_desc", page: 1 };

/**
 * The one place the URL is turned into a query for the candidate index. Shared by
 * the route loader and the component so both always read the same cache entry.
 */
function buildFilters(search: SearchState) {
  return {
      q: search.q || undefined,
      organization_id: search.organization_id || undefined,
      position_id: search.position_id || undefined,
      stage: search.stage || undefined,
      admin_status: search.admin_status || undefined,
      processing_state: search.processing_state || undefined,
      client_visibility: search.client_visibility || undefined,
      eligibility_status: search.eligibility_status || undefined,
      score_band: search.score_band || undefined,
      confidence: search.confidence || undefined,
      contact_released: search.contact_released || undefined,
      critical: search.critical || undefined,
      country: search.country || undefined,
      source: search.source || undefined,
      rejection_reason: search.rejection_reason || undefined,
      date_from: search.date_from || undefined,
      date_to: search.date_to ? `${search.date_to}T23:59:59Z` : undefined,
      sort: search.sort as never,
      limit: PAGE_SIZE,
      offset: Math.max(0, (search.page - 1) * PAGE_SIZE),
  };
}

export const Route = createFileRoute("/_authenticated/admin/candidates/")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams(SEARCH_DEFAULTS)] },
  // Only the fields the query reads, so unrelated URL params never refetch.
  loaderDeps: ({ search }) => ({ filters: buildFilters(search) }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["candidate-index", deps.filters],
      queryFn: () => searchCandidateIndex({ data: deps.filters }),
    }),
  head: () => ({
    meta: [
      { title: "Candidate database · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CandidatesPage,
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.candidates.index.tsx",
  ),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

const PAGE_SIZE = 50;

const STATE_TONE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  parsing: "bg-info/10 text-info",
  enriching: "bg-info/10 text-info",
  ready_to_score: "bg-info/10 text-info",
  scoring: "bg-info/10 text-info",
  scored: "bg-success/10 text-success",
  manual_review_required: "bg-warning/10 text-warning-foreground",
  ocr_required: "bg-warning/10 text-warning-foreground",
  failed: "bg-destructive/10 text-destructive",
  provider_blocked: "bg-destructive/10 text-destructive",
};

const REVIEW_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  on_hold: "bg-warning/10 text-warning-foreground",
};

const BAND_TONE: Record<string, string> = {
  exceptional: "bg-success/15 text-success",
  top: "bg-success/10 text-success",
  strong: "bg-info/10 text-info",
  consider: "bg-warning/10 text-warning-foreground",
  not_recommended: "bg-destructive/10 text-destructive",
  unscored: "bg-muted text-muted-foreground",
};

const PROCESSING_STATES = [
  "queued", "parsing", "ocr_required", "parsed", "enriching",
  "ready_to_score", "scoring", "scored",
  "manual_review_required", "provider_blocked", "failed",
];

const SCORE_BANDS = ["exceptional", "top", "strong", "consider", "not_recommended", "unscored"];
const STAGES = [
  "new", "reviewing", "delivered", "shortlisted",
  "interview_process", "offer", "hired", "not_moving_forward", "archived",
];

const FILTER_LABELS: Partial<Record<keyof SearchState, string>> = {
  q: "Search",
  organization_id: "Client",
  position_id: "Job",
  stage: "Stage",
  admin_status: "Approval",
  processing_state: "Screening",
  client_visibility: "Publication",
  eligibility_status: "Eligibility",
  score_band: "Score band",
  confidence: "Confidence",
  contact_released: "Contact",
  critical: "Flags",
  country: "Location",
  source: "Source",
  rejection_reason: "Rejection reason",
  date_from: "From",
  date_to: "To",
};

const EMPTY = EMPTY_DEFAULTS as Partial<SearchState>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function CandidatesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const searchFn = useServerFn(searchCandidateIndex);
  const orgsFn = useServerFn(listOrgOptions);
  const positionsFn = useServerFn(listPositionOptions);
  const countriesFn = useServerFn(listCandidateCountries);
  const bulkFn = useServerFn(bulkSetClientVisibility);

  const [q, setQ] = useState(search.q ?? "");
  useEffect(() => setQ(search.q ?? ""), [search.q]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | "visible" | "hidden">(null);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const filters = useMemo(() => buildFilters(search), [search]);

  // Primary read matches every other admin desk: primed in the loader, read
  // with suspense, so the page never flickers through a bare loading state.
  const {
    data,
    isFetching,
    isError: searchFailed,
    refetch: refetchSearch,
  } = useSuspenseQuery({
    queryKey: ["candidate-index", filters],
    queryFn: () => searchFn({ data: filters }),
  });

  const rows = (data?.rows ?? []) as AnyRow[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: orgs = [] } = useQuery({ queryKey: ["admin-orgs"], queryFn: () => orgsFn() });
  const { data: positions = [] } = useQuery({
    queryKey: ["admin-positions-filter", search.organization_id],
    queryFn: () => positionsFn({ data: { organization_id: search.organization_id || undefined } }),
  });
  const { data: countries = [] } = useQuery({
    queryKey: ["admin-candidate-countries"],
    queryFn: () => countriesFn(),
  });

  const setF = (patch: Partial<SearchState>) =>
    navigate({ search: { ...search, ...patch, page: 1 } });

  const activeChips = (Object.keys(FILTER_LABELS) as Array<keyof SearchState>)
    .filter((k) => (search[k] ?? "") !== "")
    .map((k) => ({ key: k, label: FILTER_LABELS[k]!, value: String(search[k]) }));

  const bulk = useMutation({
    mutationFn: (visibility: "visible" | "hidden") =>
      bulkFn({ data: { match_ids: selected, visibility } }),
    onSuccess: (res) => {
      if (res.failed === 0) toast.success(`${res.succeeded} candidate(s) updated`);
      else
        toast.warning(
          `${res.succeeded} updated, ${res.failed} skipped — ${res.results
            .filter((r) => !r.ok)
            .slice(0, 3)
            .map((r) => r.error)
            .join("; ")}`,
        );
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["candidate-index"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allChecked = rows.length > 0 && selected.length === rows.length;
  const toggleAll = () =>
    setSelected(allChecked ? [] : rows.map((r) => r.match_id as string));
  const toggleOne = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const sortHeader = (label: string, asc: string, desc: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => setF({ sort: search.sort === desc ? asc : desc })}
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-60" />
    </button>
  );

  const filterControls = (
    <>
          <form
            className="col-span-2"
            onSubmit={(e) => {
              e.preventDefault();
              setF({ q });
            }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, phone, job or client"
              aria-label="Search candidates"
            />
          </form>

          <FilterSelect
            label="Client"
            value={search.organization_id}
            onChange={(v) => setF({ organization_id: v, position_id: "" })}
            anyLabel="Any client"
            options={(orgs as AnyRow[]).map((o) => ({ value: o.id, label: o.name }))}
          />
          <FilterSelect
            label="Job"
            value={search.position_id}
            onChange={(v) => setF({ position_id: v })}
            anyLabel="Any job"
            options={(positions as AnyRow[]).map((p) => ({ value: p.id, label: p.title }))}
          />
          <FilterSelect
            label="Application stage"
            value={search.stage}
            onChange={(v) => setF({ stage: v })}
            anyLabel="Any stage"
            options={STAGES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
          />
          <FilterSelect
            label="Screening state"
            value={search.processing_state}
            onChange={(v) => setF({ processing_state: v })}
            anyLabel="Any screening state"
            options={PROCESSING_STATES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
          />
          <FilterSelect
            label="Approval"
            value={search.admin_status}
            onChange={(v) => setF({ admin_status: v })}
            anyLabel="Any approval"
            options={["pending", "approved", "rejected", "on_hold"].map((s) => ({
              value: s,
              label: s.replace(/_/g, " "),
            }))}
          />
          <FilterSelect
            label="Publication"
            value={search.client_visibility}
            onChange={(v) => setF({ client_visibility: v })}
            anyLabel="Any publication"
            options={[
              { value: "hidden", label: "Not published" },
              { value: "visible", label: "Published to client" },
            ]}
          />
          <FilterSelect
            label="Contact release"
            value={search.contact_released}
            onChange={(v) => setF({ contact_released: v })}
            anyLabel="Any contact state"
            options={[
              { value: "released", label: "Contact released" },
              { value: "withheld", label: "Contact withheld" },
            ]}
          />
          <FilterSelect
            label="Score band"
            value={search.score_band}
            onChange={(v) => setF({ score_band: v })}
            anyLabel="Any score band"
            options={SCORE_BANDS.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
          />
          <FilterSelect
            label="Evidence confidence"
            value={search.confidence}
            onChange={(v) => setF({ confidence: v })}
            anyLabel="Any confidence"
            options={[
              { value: "high", label: "High (≥ 0.8)" },
              { value: "medium", label: "Medium (0.5–0.8)" },
              { value: "low", label: "Low (< 0.5)" },
            ]}
          />
          <FilterSelect
            label="Critical flags"
            value={search.critical}
            onChange={(v) => setF({ critical: v })}
            anyLabel="Any flags"
            options={[
              { value: "flagged", label: "Flagged only" },
              { value: "clear", label: "No flags" },
            ]}
          />
          <FilterSelect
            label="Location"
            value={search.country}
            onChange={(v) => setF({ country: v })}
            anyLabel="Any location"
            options={(countries as string[]).map((c) => ({ value: c, label: c }))}
          />
          <FilterSelect
            label="Source"
            value={search.source}
            onChange={(v) => setF({ source: v })}
            anyLabel="Any source"
            options={["inbound", "outbound", "referral", "agency", "import"].map((s) => ({
              value: s,
              label: s,
            }))}
          />
          <FilterSelect
            label="Rejection reason"
            value={search.rejection_reason}
            onChange={(v) => setF({ rejection_reason: v })}
            anyLabel="Any reason"
            options={REJECTION_REASONS.map((r) => ({ value: r.code, label: r.label }))}
          />
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={search.date_from}
              onChange={(e) => setF({ date_from: e.target.value })}
              aria-label="Applied from"
            />
            <Input
              type="date"
              value={search.date_to}
              onChange={(e) => setF({ date_to: e.target.value })}
              aria-label="Applied until"
            />
          </div>
    </>
  );

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidate database</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every row is one candidate submission. Counts always match the records behind them.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground" aria-live="polite">
            {searchFailed
              ? "Couldn't load candidates"
              : isFetching
                ? "Searching…"
                : `${total} submission${total === 1 ? "" : "s"}`}
          </div>
          <ExportControl
            scope={{
              organization_id: search.organization_id || undefined,
              position_id: search.position_id || undefined,
              stage: search.stage || undefined,
              client_visibility: search.client_visibility || undefined,
              recommendation: undefined,
              score_band: search.score_band || undefined,
              date_from: search.date_from || undefined,
              date_to: search.date_to ? `${search.date_to}T23:59:59Z` : undefined,
            }}
          />
        </div>

      </header>

      <div className="mb-4 space-y-3">
        <DuplicateCandidatesBanner onReview={() => setShowDuplicates(true)} />
        {showDuplicates ? <DuplicateCandidatesPanel /> : null}
      </div>



      <SavedViewsBar
        surface="admin_candidates"
        canShare
        currentFilters={Object.fromEntries(
          (Object.keys(FILTER_LABELS) as Array<keyof SearchState>).map((k) => [
            k,
            String(search[k] ?? ""),
          ]),
        )}
        onApply={(f) =>
          navigate({ search: { ...search, ...EMPTY, ...(f as Partial<SearchState>), page: 1 } })
        }
      />

      {/* Filters */}
      {/* Filters: full grid on desktop, drawer on small screens */}
      <div className="mt-4 hidden grid-cols-2 gap-2 md:grid md:grid-cols-4 xl:grid-cols-6">
        {filterControls}
      </div>
      <FilterDrawer
        className="mt-4 md:hidden"
        activeCount={activeChips.length}
        onClear={() => navigate({ search: { ...search, ...EMPTY, page: 1 } as SearchState })}
      >
        {filterControls}
      </FilterDrawer>

      {/* Active filters */}
      {activeChips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {activeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setF({ [c.key]: "" } as Partial<SearchState>)}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs hover:bg-muted"
            >
              <span className="text-muted-foreground">{c.label}:</span>
              <span className="max-w-[160px] truncate">{c.value.replace(/_/g, " ")}</span>
              <X className="h-3 w-3" />
            </button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => navigate({ search: { ...search, ...EMPTY, page: 1 } as SearchState })}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Bulk bar */}
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <span className="text-xs text-muted-foreground">
            Publishing only succeeds where an approved score run exists.
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected([])}>
              Clear selection
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm("hidden")}>
              Unpublish
            </Button>
            <Button size="sm" onClick={() => setConfirm("visible")}>
              Publish to client
            </Button>
          </div>
          <div className="w-full">
            <BulkOpsBar
              matchIds={selected}
              candidateProfileIds={[
                ...new Set(
                  rows
                    .filter((r) => selected.includes(r.match_id))
                    .map((r) => r.candidate_profile_id as string)
                    .filter(Boolean),
                ),
              ]}
              positions={[
                ...new Map(
                  rows
                    .filter((r) => r.position_id && r.position_title)
                    .map((r) => [r.position_id as string, { id: r.position_id as string, title: r.position_title as string }]),
                ).values(),
              ]}
              onDone={() => setSelected([])}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-4 hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={toggleAll}
                  aria-label="Select all rows on this page"
                />
              </th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => setF({ sort: "name_asc" })}
                >
                  Candidate
                  <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Screening</th>
              <th className="px-3 py-2 text-right">
                {sortHeader("Score", "score_asc", "score_desc")}
              </th>
              <th className="px-3 py-2">Band</th>
              <th className="px-3 py-2">Approval</th>
              <th className="px-3 py-2">Client access</th>
              <th className="px-3 py-2">
                {sortHeader("Updated", "updated_asc", "updated_desc")}
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((m) => {
              const score = m.final_score ?? m.score;
              const updated = m.updated_at ? new Date(m.updated_at) : null;
              return (
                <tr
                  key={m.match_id}
                  className="hover:bg-muted/30"
                  data-qa-row="candidate-match"
                  data-submission-id={m.match_id}
                >
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected.includes(m.match_id)}
                      onCheckedChange={() => toggleOne(m.match_id)}
                      aria-label={`Select ${m.full_name ?? "candidate"}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/candidates/$id"
                      params={{ id: m.match_id }}
                      className="block hover:underline"
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        {m.full_name ?? "Unnamed candidate"}
                        {m.has_critical_flag && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-destructive"
                            aria-label="Critical flag"
                          />
                        )}
                      </div>
                      <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {m.email}
                        {m.city ? ` · ${m.city}` : ""}
                        {m.country ? `, ${m.country}` : ""}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{m.org_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    <Link
                      to="/admin/positions/$id"
                      params={{ id: m.position_id }}
                      className="hover:underline"
                    >
                      {m.position_title ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs ${
                        STATE_TONE[m.processing_state] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {(m.processing_state ?? "").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="inline-flex items-center justify-end gap-1">
                      {score == null ? "—" : Math.round(Number(score))}
                      {score != null && <ScoreStalenessChip freshness={freshnessFromRow(m)} compact />}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={`whitespace-nowrap text-xs ${BAND_TONE[m.score_band] ?? ""}`}
                    >
                      {(m.score_band ?? "unscored").replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs ${
                        REVIEW_TONE[m.admin_status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {(m.admin_status ?? "pending").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge
                        variant={m.client_visibility === "visible" ? "default" : "outline"}
                        className="whitespace-nowrap text-xs"
                      >
                        {m.client_visibility === "visible" ? "Published" : "Not published"}
                      </Badge>
                      {m.contact_released && (
                        <Badge variant="outline" className="gap-1 whitespace-nowrap text-xs">
                          <Unlock className="h-3 w-3" /> Contact
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {updated ? updated.toLocaleDateString() : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button asChild size="sm" variant="ghost" data-qa-action="open-candidate">
                      <Link to="/admin/candidates/$id" params={{ id: m.match_id }}>
                        Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !isFetching && searchFailed && (
              <tr>
                <td colSpan={11} className="p-4">
                  <ErrorState
                    title="We couldn't load candidates"
                    description="This is on our side, not your filters. Try again."
                    onRetry={() => void refetchSearch()}
                  />
                </td>
              </tr>
            )}
            {rows.length === 0 && !isFetching && !searchFailed && (
              <tr>
                <td colSpan={11} className="px-3 py-16 text-center text-muted-foreground">
                  No candidates match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="mt-4 space-y-3 md:hidden">
        {rows.map((m) => (
          <li
            key={m.match_id}
            className="rounded-lg border bg-card p-3"
            data-qa-row="candidate-match"
            data-submission-id={m.match_id}
          >
            <Link to="/admin/candidates/$id" params={{ id: m.match_id }} className="block">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{m.full_name ?? "Unnamed candidate"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {m.org_name} · {m.position_title}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-right text-sm font-semibold tabular-nums">
                  {m.final_score ?? m.score == null
                    ? "—"
                    : Math.round(Number(m.final_score ?? m.score))}
                  <ScoreStalenessChip freshness={freshnessFromRow(m)} compact />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <span
                  className={`rounded px-2 py-0.5 ${
                    STATE_TONE[m.processing_state] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {(m.processing_state ?? "").replace(/_/g, " ")}
                </span>
                <span className={`rounded px-2 py-0.5 ${BAND_TONE[m.score_band] ?? "bg-muted"}`}>
                  {(m.score_band ?? "unscored").replace(/_/g, " ")}
                </span>
                <span className={`rounded px-2 py-0.5 ${REVIEW_TONE[m.admin_status] ?? "bg-muted"}`}>
                  {(m.admin_status ?? "pending").replace(/_/g, " ")}
                </span>
                <span className="rounded border px-2 py-0.5">
                  {m.client_visibility === "visible" ? "Published" : "Not published"}
                </span>
              </div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && !isFetching && searchFailed && (
          <li>
            <ErrorState
              title="We couldn't load candidates"
              description="This is on our side, not your filters. Try again."
              onRetry={() => void refetchSearch()}
            />
          </li>
        )}
        {rows.length === 0 && !isFetching && !searchFailed && (
          <li className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
            No candidates match your filters.
          </li>
        )}
      </ul>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {total === 0
            ? "No results"
            : `Showing ${filters.offset + 1}–${Math.min(filters.offset + rows.length, total)} of ${total} · page ${search.page} of ${totalPages}`}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={search.page <= 1}
            onClick={() => navigate({ search: { ...search, page: search.page - 1 } })}
          >
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={search.page >= totalPages}
            onClick={() => navigate({ search: { ...search, page: search.page + 1 } })}
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "visible" ? "Publish to client?" : "Unpublish from client?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "visible"
                ? `${selected.length} candidate(s) will become visible to the client. Candidates without an approved score run are skipped and reported.`
                : `${selected.length} candidate(s) will be hidden from the client immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) bulk.mutate(confirm);
                setConfirm(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  anyLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  anyLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value || "any"} onValueChange={(v) => onChange(v === "any" ? "" : v)}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">{anyLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
