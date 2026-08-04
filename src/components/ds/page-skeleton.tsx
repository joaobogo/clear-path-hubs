import { cn } from "@/lib/utils";
import { Skeleton } from "./loading-skeleton";

/**
 * Layout-stable loading shells.
 *
 * Each shell mirrors the footprint of the real content it replaces — same
 * header height, same row height, same column count — so nothing jumps when the
 * data arrives. All shells announce once, politely, and hide their bones from
 * assistive technology.
 */
function Shell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy="true" className={className}>
      <span role="status" aria-live="polite" className="sr-only">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Full page: title block, optional filter row, then a content grid. */
export function PageSkeleton({
  label = "Loading this screen",
  filters = true,
  blocks = 3,
  className,
}: {
  label?: string;
  filters?: boolean;
  blocks?: number;
  className?: string;
}) {
  return (
    <Shell label={label} className={cn("space-y-6 p-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      {filters ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: blocks }).map((_, i) => (
          <Skeleton key={i} className={cn("h-40 rounded-xl", i === 0 && "md:col-span-2")} />
        ))}
      </div>
    </Shell>
  );
}

/** Table body only — keeps the caller's real header in place. */
export function TableRowsSkeleton({
  rows = 6,
  cols = 4,
  rowHeight = 44,
  label = "Loading records",
  className,
}: {
  rows?: number;
  cols?: number;
  rowHeight?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Shell label={label} className={cn("divide-y", className)}>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid items-center gap-3 px-3"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, height: rowHeight }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-4/5" : "w-3/5")} />
          ))}
        </div>
      ))}
    </Shell>
  );
}

/** Detail record: summary card plus stacked sections. */
export function DetailSkeleton({
  label = "Loading this record",
  sections = 3,
  className,
}: {
  label?: string;
  sections?: number;
  className?: string;
}) {
  return (
    <Shell label={label} className={cn("space-y-5", className)}>
      <div className="rounded-xl border p-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="mt-2 h-4 w-40" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </div>
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
        </div>
      ))}
    </Shell>
  );
}

/** Card list, e.g. candidate cards or conversations. */
export function CardListSkeleton({
  items = 4,
  height = 132,
  label = "Loading records",
  className,
}: {
  items?: number;
  height?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Shell label={label} className={cn("grid gap-3 md:grid-cols-2", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className="rounded-xl" style={{ height }} />
      ))}
    </Shell>
  );
}

/** Metric grid + chart area for analytics screens. */
export function AnalyticsSkeleton({
  label = "Calculating figures",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Shell label={label} className={cn("space-y-4", className)}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </Shell>
  );
}
