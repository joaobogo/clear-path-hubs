import { Link } from "@tanstack/react-router";
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
import { Search, AlertCircle } from "lucide-react";
import { SavedViewsBar } from "@/components/workspace/saved-views-bar";
import type { Row } from "@/components/client/position-list/position-cards";
import { ROLE_STATUS_TABS } from "@/lib/client-role-status-tabs";
import { plural } from "@/lib/format/plural";

// Canonical tab set + status mapping lives in one module so no role status can
// fall between tabs. Re-exported here for existing importers.
export const STATUS_TABS = ROLE_STATUS_TABS;

/**
 * "Review →" must land the client exactly where the fix happens — the right
 * page and the right spot on it. The server hands us a typed target computed
 * from the same precedence as the label, so the two can never disagree. When
 * no target exists (nothing actionable to open) we fall back to the brief.
 */
function ActionLink({ row }: { row: Row }) {
  const target = row.action_target ?? null;
  const cls = "text-xs font-medium text-primary hover:underline shrink-0";
  if (target?.kind === "confirm_interview") {
    return (
      <Link
        to="/client/interviews"
        search={{ interview: target.search.interview, feedback: undefined }}
        className={cls}
      >
        Confirm a time →
      </Link>
    );
  }
  if (target?.kind === "offer_response") {
    return (
      <Link to="/client/offers" className={cls}>
        See the offer →
      </Link>
    );
  }
  if (target?.kind === "review_candidates") {
    return (
      <Link to="/client/candidates" search={target.search} className={cls}>
        Review candidates →
      </Link>
    );
  }
  return (
    <Link
      to="/client/positions/$id/edit"
      params={{ id: row.id }}
      search={{ step: undefined }}
      className={cls}
    >
      Review →
    </Link>
  );
}

export function ActionRequiredBanner({ actionItems }: { actionItems: Row[] }) {
  if (actionItems.length === 0) return null;
  return (
    <section className="mb-6 rounded-xl border taas-bd-warning taas-bg-warning-soft p-4 ">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="h-4 w-4 taas-fg-warning " />
        <h2 className="text-sm font-semibold">Action required</h2>
        <span className="text-xs text-muted-foreground">
          {plural(actionItems.length, "position")}
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
            <ActionLink row={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}


export function StatusTabs({
  status,
  setSearch,
  counts,
}: {
  status: string;
  setSearch: (patch: Record<string, string>) => void;
  counts?: Record<string, number>;
}) {
  return (
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
          {counts ? (
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({counts[t.key] ?? 0})
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({
  orgId,
  ctx,
  status,
  q,
  location,
  view,
  sort,
  locations,
  searchInput,
  setSearchInput,
  setSearch,
  navigate,
}: {
  orgId: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any;
  status: string;
  q: string;
  location: string;
  view: string;
  sort: string;
  locations: string[];
  searchInput: string;
  setSearchInput: (v: string) => void;
  setSearch: (patch: Record<string, string>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigate: (opts: any) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button asChild size="sm">
        {/* Signed in, so the role is created inside this workspace — never the public signup wizard. */}
        <Link to="/client/positions/new">New role</Link>
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
          aria-label="Search roles"
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
        <SelectTrigger className="w-[180px]" aria-label="Sort roles">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="action">Action required first</SelectItem>
          <SelectItem value="updated">Recently updated</SelectItem>
          <SelectItem value="delivered">Most candidates</SelectItem>
          <SelectItem value="title">Title (A–Z)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function ActiveChips({
  activeChips,
  clearAll,
}: {
  activeChips: Array<{ key: string; label: string; onClear: () => void }>;
  clearAll: () => void;
}) {
  if (activeChips.length === 0) return null;
  return (
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
  );
}
