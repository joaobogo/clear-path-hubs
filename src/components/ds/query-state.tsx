import type { ReactNode } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeError, logTechnical, type AudienceTone } from "@/lib/error-taxonomy";
import { ErrorState } from "./error-state";
import { EmptyState } from "./empty-state";
import { PermissionState } from "./state-views";
import { useOnline } from "@/hooks/use-online";
import { useStuckAfter, STUCK_ERROR } from "@/lib/client/panel-gate";
import { resolveQueryPhase } from "./query-phase";

export interface QueryStateProps<T> {
  /** TanStack Query-ish result. Only these fields are read. */
  query: {
    data: T | undefined;
    isPending?: boolean;
    isLoading?: boolean;
    isFetching?: boolean;
    isError?: boolean;
    error?: unknown;
    refetch?: () => unknown;
  };
  /** Skeleton that matches the final layout — prevents layout jump. */
  skeleton: ReactNode;
  /** Render the happy path. Called only with defined data. */
  children: (data: T) => ReactNode;
  /** Treat this data as "nothing to show". */
  isEmpty?: (data: T) => boolean;
  /** Empty for a brand-new account (no records exist at all). */
  empty?: ReactNode;
  /** Empty because filters exclude everything — never a false zero. */
  filteredEmpty?: ReactNode;
  /** True when the caller has filters applied. */
  hasFilters?: boolean;
  tone?: AudienceTone;
  /** Name used for private logging only. */
  surface: string;
  className?: string;
}

/**
 * One place that renders every non-happy-path read state:
 * initial loading (skeleton) → refetch (keeps last safe data, subtle bar) →
 * offline → permission denied → error (human copy + correlation id + retry) →
 * truly empty vs filtered-zero → data.
 */
export function QueryState<T>({
  query,
  skeleton,
  children,
  isEmpty,
  empty,
  filteredEmpty,
  hasFilters,
  tone = "client",
  surface,
  className,
}: QueryStateProps<T>) {
  const online = useOnline();
  const pending = query.isPending ?? query.isLoading ?? false;
  const hasData = query.data !== undefined;
  // Backstop: a skeleton is never terminal. If the first read is still pending
  // after a bounded wait, treat it as a failure with a reason and a Retry.
  // Timed from "no data", not from "pending": a query gated off by
  // `enabled: false` is never pending, and must still not wait forever.
  const stuck = useStuckAfter(!hasData && !query.isError);
  const phase = resolveQueryPhase({
    pending,
    hasData,
    isError: Boolean(query.isError),
    stuck,
  });

  if (phase === "stuck") {
    return (
      <ErrorState
        className={className}
        title="This took longer than expected"
        description={STUCK_ERROR.message}
        onRetry={query.refetch ? () => query.refetch?.() : undefined}
      />
    );
  }

  // Initial load: layout-matched skeleton, never a bare spinner.
  if (phase === "loading") {
    return (
      <div className={className} aria-busy="true" aria-live="polite">
        {skeleton}
      </div>
    );
  }

  // Error with no safe data to fall back on.
  if (phase === "error") {
    const normalized = normalizeError(query.error, { tone });
    logTechnical(query.error, normalized, { surface });

    if (normalized.kind === "permission_denied") {
      // Deliberately does not confirm whether the record exists.
      return (
        <PermissionState
          className={className}
          title={normalized.title}
          description={normalized.description}
        />
      );
    }
    return (
      <ErrorState
        className={className}
        title={!online ? "You're offline" : normalized.title}
        description={
          !online
            ? "We can't reach the network right now. Nothing you did was lost."
            : normalized.description
        }
        traceId={normalized.correlationId}
        onRetry={query.refetch ? () => query.refetch?.() : undefined}
      />
    );
  }

  if (!hasData) {
    return <div className={className}>{skeleton}</div>;
  }

  const data = query.data as T;
  const emptyNow = isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0;

  if (emptyNow) {
    if (hasFilters) {
      return (
        <div className={className}>
          {filteredEmpty ?? (
            <EmptyState
              title="No results match these filters"
              description="Nothing here is missing — your filters are just narrow. Clear one to widen the search."
            />
          )}
        </div>
      );
    }
    return (
      <div className={className}>
        {empty ?? <EmptyState title="Nothing here yet" description="This is where new records will appear." />}
      </div>
    );
  }

  // Data present. A background refetch keeps the last safe data on screen and
  // only adds a quiet indicator, so nothing jumps and no false zero appears.
  const refetching = Boolean(query.isFetching) && !pending;
  const staleAfterError = Boolean(query.isError) && hasData;

  return (
    <div className={cn("relative", className)}>
      {refetching ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm"
        >
          <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden />
          Updating
        </div>
      ) : null}
      {staleAfterError ? (
        <div
          role="status"
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground"
        >
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          <span>Showing the last version we loaded — the latest update didn't come through.</span>
          {query.refetch ? (
            <Button size="sm" variant="outline" className="h-7" onClick={() => query.refetch?.()}>
              Refresh
            </Button>
          ) : null}
        </div>
      ) : null}
      {children(data)}
    </div>
  );
}
