import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function money(amount: number, currency: string): string {
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

export function days(v: number | null): string {
  if (v === null) return "—";
  return `${v.toFixed(1)} days`;
}

export function QuestionCard({
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

export function NotAvailable({ reason }: { reason: string }) {
  return (
    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {reason} We only show figures we can back with your records — nothing here
      is estimated.
    </p>
  );
}

export function Interpretation({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-primary/40 pl-3 text-sm text-foreground">
      {children}
    </p>
  );
}
