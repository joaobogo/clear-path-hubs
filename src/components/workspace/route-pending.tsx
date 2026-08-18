/**
 * Default route-transition skeleton.
 *
 * Without it, TanStack Router keeps the previous route's fully rendered content
 * on screen while the next route's loader/queries resolve — so the whole stale
 * Work queue sat under a new breadcrumb for seconds. This renders immediately on
 * every navigation (defaultPendingMs: 0), so content never outlives its URL.
 */
export function RoutePendingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <div className="h-7 w-56 rounded bg-muted" />
      <div className="h-4 w-80 rounded bg-muted/70" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border bg-card" />
        ))}
      </div>
      <div className="space-y-2 rounded-lg border bg-card p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-5 w-full rounded bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
