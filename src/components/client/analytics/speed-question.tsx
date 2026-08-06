import { Timer } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { QuestionCard, NotAvailable, Interpretation, days } from "./primitives";
import type { getClientInsights } from "@/lib/insights.functions";

type Insights = Awaited<ReturnType<typeof getClientInsights>>;
type ChartAnim = { isAnimationActive: boolean; animationDuration: number };

export function SpeedQuestion({
  speed,
  chartAnim,
}: {
  speed: Insights["speed"];
  chartAnim: ChartAnim;
}) {
  return (
    <QuestionCard
      icon={<Timer className="h-4 w-4" />}
      question="How fast are we vs. our promise?"
    >
      {!speed.available ? (
        <NotAvailable reason={speed.reason ?? ""} />
      ) : (
        <>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={speed.rows} margin={{ left: 8, right: 8 }}>
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
                  {...chartAnim}
                >
                  <LabelList dataKey="promise_days" position="top" />
                </Bar>
                <Bar
                  dataKey="actual_days"
                  name="Actual"
                  fill="hsl(var(--primary))"
                  radius={4}
                  {...chartAnim}
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
            {speed.rows.map((r) => (
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
              const first = speed.rows[0];
              if (!first || first.variance_days === null)
                return "Measured across your roles with a live commitment.";
              const late = first.variance_days > 0;
              return `${late ? "We are running behind" : "We are keeping ahead of"} the promise we made at role launch: ${first.label.toLowerCase()} took ${days(first.actual_days)} against ${first.promise_days} promised, measured across ${first.measured} role${first.measured === 1 ? "" : "s"}.`;
            })()}
          </Interpretation>
        </>
      )}
    </QuestionCard>
  );
}
