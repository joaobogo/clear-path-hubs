import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: number | string | null | undefined;
  hint?: string;
  emptyHint?: string;
  drillTo?: string;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  hint,
  emptyHint,
  drillTo,
  icon,
  loading,
  className,
}: KpiCardProps) {
  const isEmpty = value === null || value === undefined || value === 0 || value === "0";
  const body = (
    <div
      className={cn(
        "group relative flex h-full flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-elevation-1)] transition-all",
        drillTo &&
          "hover:border-primary/30 hover:shadow-[var(--shadow-elevation-2)] focus-within:border-primary/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        {loading ? (
          <span className="inline-block h-8 w-16 animate-pulse rounded-md bg-muted" aria-hidden />
        ) : isEmpty ? (
          <span className="text-3xl font-semibold text-muted-foreground/60">—</span>
        ) : (
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {loading ? " " : isEmpty ? (emptyHint ?? hint ?? "No data yet.") : hint}
      </p>
    </div>
  );
  if (!drillTo) return body;
  return (
    <Link
      to={drillTo}
      className="block h-full rounded-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {body}
    </Link>
  );
}
