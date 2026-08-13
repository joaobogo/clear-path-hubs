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

export const STATUS_TABS = [
  { key: "active", label: "Active" },
  { key: "draft", label: "Under review" },
  { key: "paused", label: "Paused" },
  { key: "closed", label: "Archived" },
] as const;

export function ActionRequiredBanner({ actionItems }: { actionItems: Row[] }) {
  if (actionItems.length === 0) return null;
  return (
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
  );
}

export function StatusTabs({
  status,
  setSearch,
}: {
  status: string;
  setSearch: (patch: Record<string, string>) => void;
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
