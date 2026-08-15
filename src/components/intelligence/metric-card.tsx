import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  CircleSlash,
  Clock,
  Info,
  Minus,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import {
  freshnessLabel,
  type IntelligenceMetric,
  type MetricChart,
  type MetricStatus,
} from "@/lib/intelligence/hiring-intelligence";

/**
 * One metric, one decision question, six honest states.
 *
 * Accessibility rules held here:
 *  - Status is never colour-only: every state carries an icon and a word.
 *  - Every chart ships with a real <table> of the same numbers, so screen
 *    readers and keyboard users get the full data, not a picture of it.
 *  - Bars are div-based, so they scale with text and need no JS to be read.
 */

const STATUS_META: Record<
  MetricStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  ok: { label: "Live", icon: Info, className: "border-emerald-600/30 text-emerald-700" },
  partial: { label: "Partial data", icon: TriangleAlert, className: "border-amber-600/40 text-amber-700" },
  insufficient: { label: "Not enough data", icon: CircleSlash, className: "border-muted-foreground/40 text-muted-foreground" },
  no_data: { label: "No data yet", icon: CircleSlash, className: "border-muted-foreground/40 text-muted-foreground" },
  stale: { label: "Stale", icon: Clock, className: "border-amber-600/40 text-amber-700" },
  error: { label: "Could not load", icon: ShieldAlert, className: "border-destructive/50 text-destructive" },
};

const TONE_BAR: Record<string, string> = {
  good: "bg-emerald-600",
  warn: "bg-amber-500",
  bad: "bg-destructive",
  neutral: "bg-primary",
};

function StatusChip({ status }: { status: MetricStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${meta.className}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

function ChartBlock({ chart, idPrefix }: { chart: MetricChart; idPrefix: string }) {
  const max = Math.max(1, ...chart.points.map((p) => Math.max(p.value, p.compareValue ?? 0)));
  const tableId = `${idPrefix}-table`;
  const total = chart.points.reduce((sum, p) => sum + p.value, 0);
  const heading = chart.valueHeading.toLowerCase() === chart.unit.toLowerCase()
    ? `${total} ${chart.unit}`
    : `${chart.valueHeading} across ${chart.unit}`;
  return (
    <figure className="m-0">
      <ul className="space-y-2" aria-describedby={tableId}>
        {chart.points.map((p) => (
          <li key={p.key} className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3">
            <span className="truncate text-xs text-muted-foreground" title={p.label}>
              {p.label}
            </span>
            <span className="flex flex-col gap-1">
              <span
                className={`motion-bar motion-bar-update h-2.5 rounded-full ${TONE_BAR[p.tone ?? "neutral"]}`}
                style={{ width: `${Math.max(2, (p.value / max) * 100)}%` }}
              />
              {p.compareValue != null && (
                <span
                  className="motion-bar motion-bar-update h-1.5 rounded-full bg-muted-foreground/50"
                  style={{ width: `${Math.max(2, (p.compareValue / max) * 100)}%` }}
                />
              )}
            </span>
            <span className="text-xs font-medium tabular-nums">
              {p.value}
              {p.compareValue != null ? ` / ${p.compareValue}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">
        {heading}
      </figcaption>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted-foreground underline">
          View as table
        </summary>
        <table id={tableId} className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">{chart.valueHeading} with explanation per row</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">Item</th>
              <th scope="col" className="py-1 pr-3 font-medium">{chart.valueHeading}</th>
              {chart.compareHeading && (
                <th scope="col" className="py-1 pr-3 font-medium">{chart.compareHeading}</th>
              )}
              <th scope="col" className="py-1 font-medium">What it means</th>
            </tr>
          </thead>
          <tbody>
            {chart.points.map((p) => (
              <tr key={p.key} className="border-t">
                <th scope="row" className="py-1 pr-3 font-normal">{p.label}</th>
                <td className="py-1 pr-3 tabular-nums">{p.value}</td>
                {chart.compareHeading && (
                  <td className="py-1 pr-3 tabular-nums">{p.compareValue ?? "—"}</td>
                )}
                <td className="py-1 text-muted-foreground">{p.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function MetricCardSkeleton() {
  return (
    <Card aria-busy="true">
      <CardHeader className="space-y-2 pb-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-2.5 w-3/4" />
        <span className="sr-only">Loading metric</span>
      </CardContent>
    </Card>
  );
}

export function MetricCard({
  metric,
  representative = false,
}: {
  metric: IntelligenceMetric;
  representative?: boolean;
}) {
  const dir = metric.comparison?.direction;
  const DirIcon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const showNumber = metric.value !== null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">{metric.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{metric.question}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {representative && (
              <Badge variant="outline" className="border-dashed">Representative data</Badge>
            )}
            <StatusChip status={metric.status} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {showNumber ? (
          <div>
            <p className="text-3xl font-semibold tabular-nums">{metric.value}</p>
            {metric.valueNote && (
              <p className="text-xs text-muted-foreground">{metric.valueNote}</p>
            )}
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {metric.statusReason ??
              "Nothing to show yet. We only display figures your own records can back."}
          </p>
        )}

        {showNumber && metric.statusReason && (
          <p className="flex items-start gap-2 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{metric.statusReason}</span>
          </p>
        )}

        {metric.comparison && (
          <p className="flex items-center gap-2 text-xs">
            <DirIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium">
              {metric.comparison.delta ?? "no comparison available"}
            </span>
            <span className="text-muted-foreground">
              vs {metric.comparison.baselineLabel}
              {metric.comparison.baselineValue ? ` (${metric.comparison.baselineValue})` : ""}
            </span>
          </p>
        )}

        {metric.chart && <ChartBlock chart={metric.chart} idPrefix={`metric-${metric.key}`} />}

        <p className="text-xs leading-relaxed text-muted-foreground">{metric.explanation}</p>

        {metric.action && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-semibold">{metric.action.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.action.detail}</p>
            {metric.action.link && (
              <Button asChild size="sm" variant="secondary" className="mt-2">
                <Link to={metric.action.link.to}>
                  {metric.action.link.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {freshnessLabel(metric.freshness)}
            {metric.sample ? ` · ${metric.sample.counted} ${metric.sample.unit}` : ""}
          </span>
          {metric.link && (
            <Link to={metric.link.to} className="underline hover:no-underline">
              {metric.link.label}
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
