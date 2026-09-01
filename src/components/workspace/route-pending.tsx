import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Default route-transition skeleton.
 *
 * Without it, TanStack Router keeps the previous route's fully rendered content
 * on screen while the next route's loader/queries resolve — so the whole stale
 * Work queue sat under a new breadcrumb for seconds. This renders immediately on
 * every navigation (defaultPendingMs: 0), so content never outlives its URL.
 *
 * It is also BOUNDED, and that is the more important half.
 *
 * Fifteen routes block on `context.queryClient.ensureQueryData` before they
 * render, and this is the component the router shows while they wait. It had no
 * timeout, so a read that never settled produced a skeleton that never
 * resolved: /admin/settings rendered its shell and then grey placeholders
 * across three visits at 6s, 10s and 12s — no h1, no content, no error, no
 * retry, nothing in the console. An entire desk in the sidebar was unreachable
 * (audit 1 Sep, F11).
 *
 * `errorComponent` does not cover that case. It catches a REJECTED read, not a
 * hung one, and the difference is the whole finding: a permanent skeleton looks
 * healthy and never resolves, which is worse than an error, because nobody
 * reports it as broken.
 */

/** How long a route may sit pending before the wait is called a failure. */
const ROUTE_PENDING_TIMEOUT_MS = 12_000;

export function RoutePendingSkeleton() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), ROUTE_PENDING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  if (timedOut) {
    return (
      <div
        role="alert"
        className="flex min-h-[16rem] flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-destructive">
          This page did not finish loading
        </p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Something it needs has not come back. Nothing has been lost — reload to try again, and
          if it keeps happening the page is genuinely unavailable rather than slow.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Reload
        </Button>
      </div>
    );
  }

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
