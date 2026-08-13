import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

export function SnapshotTile({
  label,
  value,
  loading,
  to,
  filter,
  org,
  emptyHint = "No figure yet",
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  to: string;
  filter?: Record<string, string>;
  org?: string;
  /** Shown instead of a number when the figure isn't available. Never a zero. */
  emptyHint?: string;
}) {
  const searchObj = { ...(filter ?? {}), ...(org ? { org } : {}) };
  const missing = !loading && (value === undefined || value === null);
  return (
    <Link
      to={to as never}
      search={Object.keys(searchObj).length ? (searchObj as never) : undefined}
      className="rounded-xl border bg-card p-3 hover:border-primary/40 transition min-h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1 min-h-[2rem]">
        {loading ? <Skeleton className="h-7 w-10" /> : (value ?? "—")}
      </div>
      {missing && <div className="text-[10px] text-muted-foreground">{emptyHint}</div>}
    </Link>
  );
}

