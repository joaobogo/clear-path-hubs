import { Wallet } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { QuestionCard, NotAvailable, Interpretation, money } from "./primitives";
import type { getClientInsights } from "@/lib/insights.functions";

type Insights = Awaited<ReturnType<typeof getClientInsights>>;

export function CostQuestion({ cost }: { cost: Insights["cost"] }) {
  return (
    <QuestionCard
      icon={<Wallet className="h-4 w-4" />}
      question="What did we spend per hire?"
    >
      {!cost.available ? (
        <NotAvailable reason={cost.reason ?? ""} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                Recorded spend
              </p>
              <p className="text-2xl font-semibold">
                {money(cost.total_spend, cost.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                Confirmed hires
              </p>
              <p className="text-2xl font-semibold">{cost.hires}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">
                Cost per hire
              </p>
              <p className="text-2xl font-semibold">
                {money(cost.cost_per_hire ?? 0, cost.currency)}
              </p>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cost.by_category} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis dataKey="category" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={4}>
                  <LabelList
                    dataKey="amount"
                    position="top"
                    formatter={(v: number) => money(v, cost.currency)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Interpretation>
            {`You hired ${cost.hires} ${cost.hires === 1 ? "person" : "people"} in this window and recorded ${money(cost.total_spend, cost.currency)} of recruiting spend, so each hire cost ${money(cost.cost_per_hire ?? 0, cost.currency)}. Based on ${cost.entries_counted} recorded spend ${cost.entries_counted === 1 ? "entry" : "entries"} — no estimates included.`}
          </Interpretation>
        </>
      )}
    </QuestionCard>
  );
}
