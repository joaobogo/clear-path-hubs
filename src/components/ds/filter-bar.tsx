import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  /** Selects, toggles, date pickers — anything that narrows the result set. */
  filters?: ReactNode;
  /** Right-aligned actions (export, saved views, primary CTA). */
  actions?: ReactNode;
  /** Active filter chips, rendered below the controls. */
  chips?: { id: string; label: string; onClear: () => void }[];
  onClearAll?: () => void;
  /** Live result count, announced to screen readers. */
  resultCount?: number;
  className?: string;
}

/** Shared search + filter header used above every list, table and board. */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  searchLabel = "Search",
  filters,
  actions,
  chips,
  onClearAll,
  resultCount,
  className,
}: FilterBarProps) {
  const hasChips = Boolean(chips && chips.length > 0);
  return (
    <div className={cn("ws-surface-sunken p-[var(--ws-density-x)]", className)}>
      <div className="flex flex-col gap-[var(--ws-density-y)] lg:flex-row lg:items-center">
        {onSearchChange ? (
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label={searchLabel}
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        ) : null}
        {filters ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div>
        ) : null}
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:ml-auto">{actions}</div>
        ) : null}
      </div>

      {(hasChips || resultCount != null) && (
        <div className="mt-[var(--ws-density-y)] flex flex-wrap items-center gap-2">
          {chips?.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onClear}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground transition-colors hover:border-[color:var(--taas-border-strong)]"
            >
              <span className="truncate">{chip.label}</span>
              <X aria-hidden className="h-3 w-3" />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          {hasChips && onClearAll ? (
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              Clear all
            </Button>
          ) : null}
          {resultCount != null ? (
            <span aria-live="polite" className="ml-auto text-xs text-muted-foreground">
              {resultCount} {resultCount === 1 ? "result" : "results"}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
