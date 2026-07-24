import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * LazyOnVisible — defer heavy secondary panels until they enter the viewport.
 *
 * Why:
 *  - Dashboards ship lots of panels; most are below the fold on first paint.
 *  - Rendering them all up-front burns main-thread time and blocks LCP.
 *
 * Usage:
 *  <LazyOnVisible fallback={<PanelSkeleton />}>
 *    <ExpensivePanel />
 *  </LazyOnVisible>
 */
export function LazyOnVisible({
  children,
  fallback = null,
  rootMargin = "200px",
  minHeight = 160,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  minHeight?: number;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? children : fallback}
    </div>
  );
}

/** Card-shaped skeleton that matches the workspace panel proportions. */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-2 h-6 w-56" />
      <div className="mt-5 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Table-shaped skeleton (candidates list, positions list). */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_100px_80px] gap-4 p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Score-tile skeleton that matches the candidate dossier header. */
export function ScoreTileSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-7 w-12" />
        </div>
      ))}
    </div>
  );
}
