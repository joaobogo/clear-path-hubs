import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  getClientAnalytics,
  getAnalyticsFilterOptions,
} from "@/lib/analytics.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Info, LineChart, TrendingUp, Clock, Filter, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/analytics")({
  head: () => ({
    meta: [
      { title: "Operational analytics · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

const WINDOWS = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 60 days", days: 60 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 180 days", days: 180 },
];

function fmtHours(h: number | null): string {
  if (h === null || Number.isNaN(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${Math.round(v * 100)}%`;
}

function AnalyticsPage() {
  const orgId = useClientOrgSearch();
  const [days, setDays] = useState(90);
  const [positionId, setPositionId] = useState<string | "all">("all");

  const runAnalytics = useServerFn(getClientAnalytics);
  const runOptions = useServerFn(getAnalyticsFilterOptions);

  const options = useQuery({
    queryKey: ["client-analytics-options", orgId],
    queryFn: () => runOptions({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const range = useMemo(() => {
    const to = new Date().toISOString();
    const from = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    return { from, to };
  }, [days]);

  const analytics = useQuery({
    queryKey: ["client-analytics", orgId, days, positionId],
    queryFn: () =>
      runAnalytics({
        data: {
          organization_id: orgId!,
          from: range.from,
          to: range.to,
          position_id: positionId === "all" ? undefined : positionId,
        },
      }),
    enabled: !!orgId,
  });

  if (!orgId) {
    return <div className="p-6 text-sm text-muted-foreground">Select an organization.</div>;
  }

  function exportCsv() {
    if (!analytics.data) return;
    const d = analytics.data;
    const rows: string[][] = [
      ["Metric", "Value", "Sample size", "Definition"],
      [
        "Time to first shortlist (h)",
        d.timing.time_to_first_shortlist.median_hours?.toFixed(2) ?? "",
        String(d.timing.time_to_first_shortlist.sample_size),
        d.timing.time_to_first_shortlist.definition,
      ],
      [
        "Time between deliveries (h)",
        d.timing.time_between_deliveries.median_hours?.toFixed(2) ?? "",
        String(d.timing.time_between_deliveries.sample_size),
        d.timing.time_between_deliveries.definition,
      ],
      [
        "Client review time (h)",
        d.timing.client_review_time.median_hours?.toFixed(2) ?? "",
        String(d.timing.client_review_time.sample_size),
        d.timing.client_review_time.definition,
      ],
      [
        "Delivered per week",
        d.timing.delivered_per_week.value.toFixed(2),
        String(d.timing.delivered_per_week.sample_size),
        d.timing.delivered_per_week.definition,
      ],
      ["Interview rate", fmtPct(d.conversion.interview_rate.value), "", "shortlisted → interview_process"],
      ["Offer rate", fmtPct(d.conversion.offer_rate.value), "", "interview_process → offer"],
      ["Hire rate", fmtPct(d.conversion.hire_rate.value), "", "offer → hired"],
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taasflow-analytics-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const data = analytics.data;
  const positions = options.data?.positions ?? [];

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        {/* Header + Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <LineChart className="h-6 w-6 text-primary" /> Operational analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              Honest, sample-aware metrics for delivery pace, review speed, funnel conversion, and rejection patterns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WINDOWS.map((w) => (
                  <SelectItem key={w.days} value={String(w.days)}>{w.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={positionId} onValueChange={(v) => setPositionId(v)}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="All positions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All positions</SelectItem>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        {analytics.isLoading && (
          <div className="grid gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
        )}

        {data && (
          <>
            {/* Totals row */}
            <div className="grid gap-4 md:grid-cols-5">
              <StatTile label="Candidates" value={String(data.totals.matches)} />
              <StatTile label="Delivered" value={String(data.totals.delivered)} />
              <StatTile label="Interviews" value={String(data.totals.interviews)} />
              <StatTile label="Offers sent" value={String(data.totals.offers_sent)} />
              <StatTile label="Hires" value={String(data.totals.hires)} />
            </div>

            {/* Timing tiles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Timing</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <TimingTile
                  label="Time to first shortlist"
                  value={fmtHours(data.timing.time_to_first_shortlist.median_hours)}
                  sample={data.timing.time_to_first_shortlist.sample_size}
                  insufficient={data.timing.time_to_first_shortlist.insufficient_data}
                  hint={data.timing.time_to_first_shortlist.definition}
                />
                <TimingTile
                  label="Between deliveries"
                  value={fmtHours(data.timing.time_between_deliveries.median_hours)}
                  sample={data.timing.time_between_deliveries.sample_size}
                  insufficient={data.timing.time_between_deliveries.insufficient_data}
                  hint={data.timing.time_between_deliveries.definition}
                />
                <TimingTile
                  label="Client review time"
                  value={fmtHours(data.timing.client_review_time.median_hours)}
                  sample={data.timing.client_review_time.sample_size}
                  insufficient={data.timing.client_review_time.insufficient_data}
                  hint={data.timing.client_review_time.definition}
                />
                <TimingTile
                  label="Delivered / week"
                  value={data.timing.delivered_per_week.value.toFixed(1)}
                  sample={data.timing.delivered_per_week.sample_size}
                  insufficient={data.timing.delivered_per_week.insufficient_data}
                  hint={data.timing.delivered_per_week.definition}
                />
              </CardContent>
            </Card>

            {/* Funnel + conversion */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Funnel & conversion</CardTitle>
              </CardHeader>
              <CardContent>
                <Funnel counts={data.funnel.counts} />
                <div className="mt-4 grid gap-2 md:grid-cols-3 text-sm">
                  <ConvRow label="Shortlisted → Interview" rate={data.conversion.interview_rate} />
                  <ConvRow label="Interview → Offer" rate={data.conversion.offer_rate} />
                  <ConvRow label="Offer → Hire" rate={data.conversion.hire_rate} />
                </div>
                <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" /> {data.conversion.definition}
                </div>
              </CardContent>
            </Card>

            {/* Aging */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stage aging (open candidates)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {data.stage_aging.rows.map((r) => (
                    <div key={r.stage} className="flex items-center gap-3 text-sm">
                      <div className="w-40 capitalize">{r.stage.replace(/_/g, " ")}</div>
                      <div className="flex-1">
                        <div className="h-2 rounded bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary/70"
                            style={{
                              width: `${Math.min(100, ((r.median_hours ?? 0) / 168) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-24 text-right tabular-nums">{fmtHours(r.median_hours)}</div>
                      <Badge variant="secondary" className="w-16 justify-center">{r.count}</Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{data.stage_aging.definition}</div>
              </CardContent>
            </Card>

            {/* Rejection reasons */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Offer close reasons</CardTitle></CardHeader>
                <CardContent>
                  {data.rejection_reasons.offer_close.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No offer closures in window.</div>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {data.rejection_reasons.offer_close.map((r) => (
                        <li key={r.reason} className="flex justify-between">
                          <span className="capitalize">{r.reason.replace(/_/g, " ")}</span>
                          <Badge variant="outline">{r.count}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Pipeline rejection notes</CardTitle></CardHeader>
                <CardContent>
                  {data.rejection_reasons.stage_moves.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No pipeline rejections logged.</div>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {data.rejection_reasons.stage_moves.map((r) => (
                        <li key={r.reason} className="flex justify-between">
                          <span className="line-clamp-1">{r.reason}</span>
                          <Badge variant="outline">{r.count}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="text-xs text-muted-foreground">
              Small samples (&lt;5) return no rate. See a candidate example in the <Link to="/client/candidates" className="underline">candidates list</Link>.
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function TimingTile({
  label, value, sample, insufficient, hint,
}: { label: string; value: string; sample: number; insufficient: boolean; hint: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {insufficient ? "—" : value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {insufficient ? `Need ≥5 samples (have ${sample})` : `n=${sample}`}
      </div>
    </div>
  );
}

function Funnel({ counts }: { counts: Record<string, number> }) {
  const stages: Array<[string, string]> = [
    ["delivered", "Delivered"],
    ["shortlisted", "Shortlisted"],
    ["interview_process", "Interview"],
    ["offer", "Offer"],
    ["hired", "Hired"],
  ];
  const max = Math.max(1, ...stages.map(([k]) => counts[k] ?? 0));
  return (
    <div className="space-y-2">
      {stages.map(([k, label]) => {
        const v = counts[k] ?? 0;
        return (
          <div key={k} className="flex items-center gap-3 text-sm">
            <div className="w-24">{label}</div>
            <div className="flex-1">
              <div className="h-3 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(v / max) * 100}%` }}
                />
              </div>
            </div>
            <div className="w-12 text-right tabular-nums">{v}</div>
          </div>
        );
      })}
    </div>
  );
}

function ConvRow({
  label, rate,
}: { label: string; rate: { value: number | null; insufficient_data: boolean } }) {
  return (
    <div className="rounded border p-2 flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">
        {rate.insufficient_data ? "—" : fmtPct(rate.value)}
      </span>
    </div>
  );
}
