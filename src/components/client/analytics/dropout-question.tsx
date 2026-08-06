import { TrendingDown } from "lucide-react";
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
import { QuestionCard, NotAvailable, Interpretation } from "./primitives";
import type { getClientInsights } from "@/lib/insights.functions";

type Insights = Awaited<ReturnType<typeof getClientInsights>>;
type ChartAnim = { isAnimationActive: boolean; animationDuration: number };

export function DropoutQuestion({
  dropout,
  chartAnim,
}: {
  dropout: Insights["dropout"];
  chartAnim: ChartAnim;
}) {
  return (
    <QuestionCard
      icon={<TrendingDown className="h-4 w-4" />}
      question="Where do candidates drop out?"
    >
      {!dropout.available ? (
        <NotAvailable reason={dropout.reason ?? ""} />
      ) : (
        <>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dropout.steps}
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
                <Bar dataKey="count" radius={4} {...chartAnim}>
                  <LabelList dataKey="count" position="right" />
                  {dropout.steps.map((s) => (
                    <Cell
                      key={s.key}
                      fill={
                        dropout.biggest_drop &&
                        s.label === dropout.biggest_drop.label
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
            {dropout.biggest_drop
              ? `Of the ${dropout.total} candidates shown to you, the largest fall-off is between ${dropout.biggest_drop.from} and ${dropout.biggest_drop.label} — ${dropout.biggest_drop.dropped} candidates stopped there.`
              : `All ${dropout.total} candidates shown to you are still moving forward — no drop-off recorded yet.`}
          </Interpretation>
        </>
      )}
    </QuestionCard>
  );
}
