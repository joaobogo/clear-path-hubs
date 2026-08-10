import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SavedViewsBar } from "@/components/workspace/saved-views-bar";
import {
  STAGE_OPTIONS,
  FIT_OPTIONS,
  CRITICAL_OPTIONS,
  REVIEW_OPTIONS,
  SORT_OPTIONS,
} from "@/components/client/candidates/constants";

export interface CandidatesFiltersState {
  q: string;
  position: string;
  stage: string;
  fit: string;
  critical: string;
  review: string;
  availability: string;
  minExp: string;
  location: string;
  sort: string;
  view: "cards" | "list" | "compare";
  filter: "all" | "top" | "interview_pipeline";
}

export function CandidatesFiltersPanel({
  search,
  setF,
  positions,
  availabilityOptions,
  activeFilters,
  clearFilters,
  compareCheck,
  setCompareOpen,
  orgId,
  ctxRole,
  onApplySavedView,
}: {
  search: CandidatesFiltersState;
  setF: (patch: Partial<CandidatesFiltersState>) => void;
  positions: Array<{ id: string; title: string }>;
  availabilityOptions: string[];
  activeFilters: { key: string; label: string }[];
  clearFilters: () => void;
  compareCheck: { ok: boolean; reason?: string | null };
  setCompareOpen: (v: boolean) => void;
  orgId: string | undefined;
  ctxRole: string | undefined;
  onApplySavedView: (f: Record<string, unknown>) => void;
}) {
  const RESET_TO_ALL = new Set(["stage", "fit", "critical", "review", "availability"]);

  return (
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
          }}
          onApply={onApplySavedView}
          canShare={ctxRole === "client_admin"}
        />
        {/* No numeric score filter on client surfaces — fit is expressed as a
            band (see the Fit select below), never as a number. */}
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
            {positions.map((p) => (
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
        <div className="flex items-stretch gap-2 justify-end">
          <Select value={search.sort} onValueChange={(v) => setF({ sort: v })}>
            <SelectTrigger className="h-10 min-w-[10rem]" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex h-10 shrink-0 items-center rounded-md border p-0.5">

            <button
              onClick={() => setF({ view: "cards" })}
              className={`h-full whitespace-nowrap px-2.5 text-xs rounded ${search.view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-pressed={search.view === "cards"}
            >
              Cards
            </button>
            <button
              onClick={() => setF({ view: "list" })}
              className={`h-full whitespace-nowrap px-2.5 text-xs rounded ${search.view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-pressed={search.view === "list"}
            >
              List
            </button>
            <button
              onClick={() => { setF({ view: "compare" }); setCompareOpen(true); }}
              disabled={!compareCheck.ok}
              title={compareCheck.reason ?? undefined}
              className={`h-full whitespace-nowrap px-2.5 text-xs rounded disabled:opacity-40 ${search.view === "compare" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-pressed={search.view === "compare"}
            >
              Side by side
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
                onClick={() => setF({ [f.key]: RESET_TO_ALL.has(f.key) ? "all" : "" } as never)}
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
  );
}
