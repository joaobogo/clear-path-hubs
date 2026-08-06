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
  if (error instanceof Error && error.message.trim()) return `${error.message}`;
  if (typeof error === "string" && error.trim()) return error;
  return FALLBACK_ERROR;
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
  children,
}: {
  query: PanelQueryState;
  /** True only when the read succeeded and returned no rows. */
  isEmpty?: boolean;
  empty?: ReactNode;
  skeletonRows?: number;
  className?: string;
  children: ReactNode;
}) {
  const loading = query.isPending ?? query.isLoading ?? false;

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

  if (isEmpty) return <>{empty ?? <PanelEmpty className={className} />}</>;

  return <>{children}</>;
}
