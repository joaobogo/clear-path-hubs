/**
 * The one wrapper every admin panel uses to tell the truth about its read.
 *
 * Three states, never blurred:
 *  - loading  → skeleton rows, so nobody reads "0" off a pending panel
 *  - error    → an error card with the user-facing message and a retry
 *  - empty    → the caller's empty state, shown ONLY when the read succeeded
 *
 * A failed read must never render an empty state: a false zero is how staff
 * stop trusting the desk.
 */
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelError } from "@/components/admin/panel-error";
import { cn } from "@/lib/utils";
import { looksTechnical } from "@/lib/error-taxonomy";

/** The slice of a TanStack Query result a panel needs to be honest. */
export type PanelQueryState = {
  isPending?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  isFetching?: boolean;
  refetch?: () => unknown;
};

const FALLBACK_ERROR =
  "We couldn't load this panel. This is a read failure on our side, not an empty result.";

export function panelErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : typeof error === "string" && error.trim()
      ? error.trim()
      : "";
  // Backend/query internals (PostgREST logic trees, SQL, stack text) must
  // never reach the screen — only messages written for a human survive.
  if (!raw || raw.length > 200 || looksTechnical(raw)) return FALLBACK_ERROR;
  return raw;
}

export function PanelSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function PanelEmpty({
  title = "Nothing here yet",
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("rounded-md border border-dashed px-4 py-8 text-center", className)}>
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

export function PanelState({
  query,
  isEmpty = false,
  empty,
  skeletonRows = 3,
  className,
  showLoadingOverlay = false,
  children,
}: {
  query: PanelQueryState;
  /** True only when the read succeeded and returned no rows. */
  isEmpty?: boolean;
  empty?: ReactNode;
  skeletonRows?: number;
  className?: string;
  /** When true, shows an overlay when refetching/loading data while keeping old content visible. */
  showLoadingOverlay?: boolean;
  children: ReactNode;
}) {
  const loading = query.isPending ?? query.isLoading ?? false;
  const fetching = query.isFetching ?? false;


  if (query.isError) {
    return (
      <PanelError
        className={className}
        message={panelErrorMessage(query.error)}
        onRetry={query.refetch ? () => void query.refetch?.() : undefined}
        retrying={query.isFetching === true}
      />
    );
  }

  if (loading) return <PanelSkeleton rows={skeletonRows} className={className} />;

  if (isEmpty && !fetching) return <>{empty ?? <PanelEmpty className={className} />}</>;

  return (
    <div className={cn("relative", className)}>
      {showLoadingOverlay && fetching && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Refreshing</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

