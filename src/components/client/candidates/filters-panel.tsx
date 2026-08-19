import { useState } from "react";
import { useDebouncedTextInput } from "@/hooks/use-debounced-text-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SlidersHorizontal, Sparkles, X } from "lucide-react";
import { UNICORN_SCORE } from "@/lib/scoring/bands";
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
  view: "cards" | "list" | "compare" | "board";
  filter: "all" | "top" | "interview_pipeline";
  /** "1" = show only unicorn candidates (95+ or an outcome-verified top hire). */
  unicorn: string;
}

/** Filters that live behind the single "Filters" button. */
const ADVANCED_KEYS = ["fit", "availability", "minExp", "location"] as const;
const RESET_TO_ALL = new Set(["stage", "fit", "critical", "review", "availability"]);
/** Chips that are toggles, not values: removing them means "off". */
const RESET_TO_OFF = new Set(["unicorn"]);

export function CandidatesFiltersPanel({
  search,
  setF,
  positions,
  availabilityOptions,
  activeFilters,
  clearFilters,
  orgId,
  ctxRole,
  onApplySavedView,
  resultCount,
  totalCount,
}: {
  search: CandidatesFiltersState;
  setF: (patch: Partial<CandidatesFiltersState>) => void;
  positions: Array<{ id: string; title: string }>;
  availabilityOptions: string[];
  activeFilters: { key: string; label: string }[];
  clearFilters: () => void;
  orgId: string | undefined;
  ctxRole: string | undefined;
  onApplySavedView: (f: Record<string, unknown>) => void;
  resultCount?: number;
  totalCount?: number;
}) {
  const [open, setOpen] = useState(false);
  // Keystrokes stay local; only the applied filter is debounced (see hook docs).
  const qInput = useDebouncedTextInput(search.q, (q) => setF({ q }));
  const advancedCount = ADVANCED_KEYS.filter((k) => {
    const v = search[k];
    return !!v && v !== "all";
  }).length;

  return (
    <section aria-label="Search and filters" className="mb-4 rounded-xl border bg-card p-3 sm:p-4">
      {/* Primary row: search · role · stage · Filters */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Input
          className="md:flex-1 md:min-w-[14rem]"
          placeholder="Search by name, skill, role, location…"
          value={qInput.value}
          onChange={(e) => qInput.onChange(e.target.value)}
          aria-label="Search candidates"
        />
        <Select
          value={search.position || "all"}
          onValueChange={(v) => setF({ position: v === "all" ? "" : v })}
        >
          <SelectTrigger className="md:w-48" aria-label="Role">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {positions.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.stage} onValueChange={(v) => setF({ stage: v })}>
          <SelectTrigger className="md:w-44" aria-label="Stage"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STAGE_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.sort} onValueChange={(v) => setF({ sort: v })}>
          <SelectTrigger className="md:w-44" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>


        {/* One tap to the strongest candidates — no manual sorting. */}
        <button
          type="button"
          onClick={() => setF({ unicorn: search.unicorn === "1" ? "0" : "1" })}
          aria-pressed={search.unicorn === "1"}
          title={`Show only candidates scoring ${UNICORN_SCORE} or above`}
          className={`inline-flex h-12 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-xs font-medium transition-colors sm:h-10 ${
            search.unicorn === "1"
              ? "border-primary bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Unicorn only ({UNICORN_SCORE}+)
        </button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-center md:w-auto" aria-label="More filters">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filters
              {advancedCount > 0 && (
                <span className="ml-2 rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground tabular-nums">
                  {advancedCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[22rem] space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">More filters</p>
              {advancedCount > 0 && (
                <Button size="sm" variant="ghost" onClick={clearFilters}>Reset</Button>
              )}
            </div>
            <FilterField label="Fit">
              <Select value={search.fit} onValueChange={(v) => setF({ fit: v })}>
                <SelectTrigger aria-label="Fit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIT_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Availability">
              <Select value={search.availability} onValueChange={(v) => setF({ availability: v })}>
                <SelectTrigger aria-label="Availability"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any availability</SelectItem>
                  {availabilityOptions.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Experience">
              <Select value={search.minExp || "all"} onValueChange={(v) => setF({ minExp: v === "all" ? "" : v })}>
                <SelectTrigger aria-label="Minimum experience"><SelectValue placeholder="Any experience" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any experience</SelectItem>
                  <SelectItem value="2">2+ years</SelectItem>
                  <SelectItem value="5">5+ years</SelectItem>
                  <SelectItem value="8">8+ years</SelectItem>
                  <SelectItem value="12">12+ years</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Location">
              <Input
                placeholder="Location"
                value={search.location}
                onChange={(e) => setF({ location: e.target.value })}
                aria-label="Filter by location"
              />
            </FilterField>
            <Button className="w-full" size="sm" onClick={() => setOpen(false)}>Done</Button>
          </PopoverContent>
        </Popover>

        {/* View is always list — no card/side-by-side toggle */}
      </div>

      {/* Result count · active filter chips · saved views */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground" data-testid="candidates-result-count">
          <span className="tabular-nums font-medium text-foreground">{resultCount ?? 0}</span>
          {typeof totalCount === "number" ? ` of ${totalCount} candidates` : " candidates"}
        </span>
        {activeFilters.map((f) => (
          <span
            key={f.key}
            className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
          >
            {f.label}
            <button
              onClick={() =>
                setF({
                  [f.key]: RESET_TO_OFF.has(f.key)
                    ? "0"
                    : RESET_TO_ALL.has(f.key)
                      ? "all"
                      : "",
                } as never)
              }
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${f.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {activeFilters.length > 0 && (
          <Button size="sm" variant="ghost" onClick={clearFilters}>Clear all</Button>
        )}
        {/* List / Board is a view of the same result set — it only writes the
            search param, so the choice is deep-linkable and survives back. */}
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Result view">
          <Button
            size="sm"
            variant={search.view === "board" ? "ghost" : "secondary"}
            className="h-11 min-w-11 px-3 text-xs sm:h-7 sm:min-w-0 sm:px-2"
            aria-pressed={search.view !== "board"}
            onClick={() => setF({ view: "list" } as never)}
          >
            List
          </Button>
          <Button
            size="sm"
            variant={search.view === "board" ? "secondary" : "ghost"}
            className="h-11 min-w-11 px-3 text-xs sm:h-7 sm:min-w-0 sm:px-2"
            aria-pressed={search.view === "board"}
            onClick={() => setF({ view: "board" } as never)}
          >
            Board
          </Button>
        </div>
        <div className="ml-auto">
          <SavedViewsBar
            surface="client_candidates"
            organizationId={orgId ?? undefined}
            currentFilters={{
              q: search.q,
              position: search.position,
              stage: search.stage,
              fit: search.fit,
              critical: search.critical,
              review: search.review,
              availability: search.availability,
              minExp: search.minExp,
              location: search.location,
              sort: search.sort,
              view: search.view,
              filter: search.filter,
              unicorn: search.unicorn,
            }}
            onApply={onApplySavedView}
            canShare={ctxRole === "client_admin"}
          />
        </div>
      </div>
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
