import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getClientInsights,
  getInsightsPositions,
} from "@/lib/insights.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonCards, NoWorkspaceState } from "@/components/client/states";
import { AnalyticsSkeleton } from "@/components/ds/page-skeleton";
import { ProcessState } from "@/components/ds/process-state";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveNoAnalyticsState } from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignals } from "@/hooks/use-empty-state-signals";
import { TrendingDown, Timer, Wallet } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

export const Route = createFileRoute("/_authenticated/client/analytics")({
  head: () => ({
    meta: [
      { title: "Three questions · TaaSFlow client workspace" },
      {
        name: "description",
        content:
          "Where candidates drop out, how fast we are against our promise, and what you spent per hire — computed from your own records.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

const WINDOWS = [30, 60, 90, 180];

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

function days(v: number | null): string {
  if (v === null) return "—";
  return `${v.toFixed(1)} days`;
}

function QuestionCard({
  icon,
  question,
  children,
}: {
  icon: React.ReactNode;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-muted-foreground">{icon}</span>
          {question}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function NotAvailable({ reason }: { reason: string }) {
  return (
    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {reason} We only show figures we can back with your records — nothing here
      is estimated.
    </p>
  );
}

function Interpretation({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-primary/40 pl-3 text-sm text-foreground">
      {children}
    </p>
  );
}

function AnalyticsPage() {
  const orgId = useClientOrgSearch();
  const [window, setWindow] = useState(90);
  const [positionId, setPositionId] = useState<string>("all");

  const runInsights = useServerFn(getClientInsights);
  const runPositions = useServerFn(getInsightsPositions);

  const positions = useQuery({
    queryKey: ["insights-positions", orgId],
    queryFn: () => runPositions({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const insights = useQuery({
    queryKey: ["client-insights", orgId, window, positionId],
    queryFn: () =>
      runInsights({
        data: {
          organization_id: orgId!,
          days: window,
          ...(positionId !== "all" ? { position_id: positionId } : {}),
        },
      }),
        enabled: !!orgId,
  });
  const signals = useEmptyStateSignals(orgId ?? undefined, {
    enabled: !insights.isLoading && !insights.data,
  });

  if (!orgId) return <NoWorkspaceState />;

  const data = insights.data;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Three questions
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Where candidates drop out, how fast we are against our promise, and
            what you spent per hire. Every number comes from your own records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={positionId}
            onValueChange={setPositionId}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {(positions.data?.positions ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(window)}
            onValueChange={(v) => setWindow(Number(v))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Last {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {insights.isLoading ? (
        <AnalyticsSkeleton label="Calculating your figures from your own records" />
      ) : insights.isError ? (
        <ProcessState
          status={{
            process: "analytics",
            phase: "failed",
            errorMessage:
              "We could not read the records behind these figures. Nothing was changed.",
          }}
          onRetry={() => void insights.refetch()}
          retrying={insights.isFetching}
        />
      ) : !data ? (
        <SurfaceState
          content={resolveNoAnalyticsState({
            observations: signals?.observations ?? 0,
            minimum: 5,
            metricLabel: "Drop-out, speed and spend",
          })}
        />
      ) : (
        <div className="grid gap-6">
          {/* 1 — Drop-out */}
          <QuestionCard
            icon={<TrendingDown className="h-4 w-4" />}
            question="Where do candidates drop out?"
          >
            {!data.dropout.available ? (
              <NotAvailable reason={data.dropout.reason ?? ""} />
            ) : (
              <>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.dropout.steps}
                      layout="vertical"
                      margin={{ left: 24, right: 32 }}
                    >
                      <CartesianGrid horizontal={false} strokeOpacity={0.2} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={110}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Bar dataKey="count" radius={4}>
                        <LabelList dataKey="count" position="right" />
                        {data.dropout.steps.map((s) => (
                          <Cell
                            key={s.key}
                            fill={
                              data.dropout.biggest_drop &&
                              s.label === data.dropout.biggest_drop.label
                                ? "hsl(var(--destructive))"
                                : "hsl(var(--primary))"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Interpretation>
                  {data.dropout.biggest_drop
                    ? `Of the ${data.dropout.total} candidates shown to you, the largest fall-off is between ${data.dropout.biggest_drop.from} and ${data.dropout.biggest_drop.label} — ${data.dropout.biggest_drop.dropped} candidates stopped there.`
                    : `All ${data.dropout.total} candidates shown to you are still moving forward — no drop-off recorded yet.`}
                </Interpretation>
              </>
            )}
          </QuestionCard>

          {/* 2 — Speed vs promise */}
          <QuestionCard
            icon={<Timer className="h-4 w-4" />}
            question="How fast are we vs. our promise?"
          >
            {!data.speed.available ? (
              <NotAvailable reason={data.speed.reason ?? ""} />
            ) : (
              <>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.speed.rows} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid vertical={false} strokeOpacity={0.2} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        label={{ value: "days", angle: -90, position: "insideLeft" }}
                      />
                      <Bar
                        dataKey="promise_days"
                        name="Promised"
                        fill="hsl(var(--muted-foreground))"
                        radius={4}
                      >
                        <LabelList dataKey="promise_days" position="top" />
                      </Bar>
                      <Bar
                        dataKey="actual_days"
                        name="Actual"
                        fill="hsl(var(--primary))"
                        radius={4}
                      >
                        <LabelList
                          dataKey="actual_days"
                          position="top"
                          formatter={(v: number) => v?.toFixed(1)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.speed.rows.map((r) => (
                    <Badge
                      key={r.key}
                      variant={
                        r.variance_days !== null && r.variance_days <= 0
                          ? "default"
                          : "destructive"
                      }
                    >
                      {r.label}: {days(r.actual_days)} vs {r.promise_days} promised
                      {r.variance_days !== null
                        ? ` (${r.variance_days <= 0 ? "" : "+"}${r.variance_days.toFixed(1)}d)`
                        : ""}
                    </Badge>
                  ))}
                </div>
                <Interpretation>
                  {(() => {
                    const first = data.speed.rows[0];
                    if (!first || first.variance_days === null)
                      return "Measured across your roles with a live commitment.";
                    const late = first.variance_days > 0;
                    return `${late ? "We are running behind" : "We are keeping ahead of"} the promise we made at role launch: ${first.label.toLowerCase()} took ${days(first.actual_days)} against ${first.promise_days} promised, measured across ${first.measured} role${first.measured === 1 ? "" : "s"}.`;
                  })()}
                </Interpretation>
              </>
            )}
          </QuestionCard>

          {/* 3 — Spend per hire */}
          <QuestionCard
            icon={<Wallet className="h-4 w-4" />}
            question="What did we spend per hire?"
          >
            {!data.cost.available ? (
              <NotAvailable reason={data.cost.reason ?? ""} />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Recorded spend
                    </p>
                    <p className="text-2xl font-semibold">
                      {money(data.cost.total_spend, data.cost.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Confirmed hires
                    </p>
                    <p className="text-2xl font-semibold">{data.cost.hires}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      Cost per hire
                    </p>
                    <p className="text-2xl font-semibold">
                      {money(data.cost.cost_per_hire ?? 0, data.cost.currency)}
                    </p>
                  </div>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.cost.by_category} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid vertical={false} strokeOpacity={0.2} />
                      <XAxis dataKey="category" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={4}>
                        <LabelList
                          dataKey="amount"
                          position="top"
                          formatter={(v: number) => money(v, data.cost.currency)}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Interpretation>
                  {`You hired ${data.cost.hires} ${data.cost.hires === 1 ? "person" : "people"} in this window and recorded ${money(data.cost.total_spend, data.cost.currency)} of recruiting spend, so each hire cost ${money(data.cost.cost_per_hire ?? 0, data.cost.currency)}. Based on ${data.cost.entries_counted} recorded spend ${data.cost.entries_counted === 1 ? "entry" : "entries"} — no estimates included.`}
                </Interpretation>
              </>
            )}
          </QuestionCard>
        </div>
      )}
    </div>
  );
}
