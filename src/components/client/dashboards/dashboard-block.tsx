/**
 * One dashboard block, rendered honestly.
 *  - Loading keeps the same height, so the layout never jumps.
 *  - Empty says what will fill it.
 *  - Unreadable says so in plain words. A zero is only ever a real zero.
 */
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import type { BlockDefinition, BlockResult } from "@/lib/dashboards/blocks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SPAN_CLASS: Record<number, string> = {
  4: "lg:col-span-4",
  6: "lg:col-span-6",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
};

export function DashboardBlock({
  definition,
  result,
  loading,
  onRemove,
}: {
  definition: BlockDefinition;
  result?: BlockResult;
  loading?: boolean;
  onRemove?: () => void;
}) {
  const data = result?.data ?? null;

  return (
    <Card className={cn("col-span-12 flex flex-col", SPAN_CLASS[definition.span])}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold">{definition.title}</CardTitle>
          <p className="text-xs text-muted-foreground">{definition.definition}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
            <Link to={definition.href as never}>
              Records <ArrowUpRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
          {onRemove && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              aria-label={`Remove ${definition.title}`}
              onClick={onRemove}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="min-h-[132px] flex-1">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : result?.unavailable ? (
          <p className="text-sm text-muted-foreground">{result.unavailable}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">{definition.emptyHint}</p>
        ) : data.kind === "stat" ? (
          <div>
            <p className="text-3xl font-semibold tracking-tight">{data.value}</p>
            <p className="text-sm text-muted-foreground">{data.caption}</p>
            {data.sub && <p className="mt-2 text-xs text-muted-foreground">{data.sub}</p>}
          </div>
        ) : data.kind === "series" ? (
          <ul className="space-y-2">
            {data.points.map((p) => {
              const max = Math.max(...data.points.map((x) => x.value), 1);
              return (
                <li key={p.label} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="capitalize text-muted-foreground">{p.label}</span>
                    <span className="font-semibold tabular-nums">{p.value}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${Math.round((p.value / max) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="divide-y">
            {data.rows.map((row) => (
              <li key={row.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {row.href ? (
                    <Link to={row.href as never} className="hover:underline">
                      {row.label}
                    </Link>
                  ) : (
                    row.label
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-medium tabular-nums">{row.value}</span>
                  {row.note && (
                    <span className="block text-xs text-muted-foreground">{row.note}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
