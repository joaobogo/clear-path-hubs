import { createFileRoute } from "@tanstack/react-router";
import { useDeliveryFailures } from "@/lib/admin/use-delivery-failures";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryState } from "@/components/ds";
import { DeliveryFailuresPanel } from "@/components/admin/delivery-failures-panel";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Delivery health · TaaSFlow" },
      {
        name: "description",
        content:
          "Monitor notification and email delivery failures across TaaSFlow and retry them safely.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const query = useDeliveryFailures();

  const email = query.data?.email as { configured: boolean; reason?: string | null } | undefined;

  // One server function, one 7-day window: these tiles, the banner and the rows
  // below all read the same payload, so they cannot disagree. Until that payload
  // arrives the tiles show "—" — a zero here would be a claim we can't back.
  const summary = query.data?.summary as
    | { total?: number; retryable?: number; blockedNotSent?: number }
    | null
    | undefined;
  const volume = query.data?.volume as
    | { emailSent: number; inAppDelivered: number }
    | undefined;

  const num = (value: number | undefined) =>
    query.data && typeof value === "number" ? value.toLocaleString() : "—";

  const tiles = [
    { label: "Emails sent (7d)", value: num(volume?.emailSent) },
    { label: "Retryable email failures (7d)", value: num(summary?.retryable) },
    { label: "Blocked before sending (7d)", value: num(summary?.blockedNotSent) },
    { label: "Rows listed below", value: num(summary?.total) },
    { label: "In-app delivered (7d)", value: num(volume?.inAppDelivered) },
  ];


  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Delivery health</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Provider acceptance is not the same as inbox delivery. Anything failed, bounced or
          suppressed lands here.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {tiles.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>


      {email && !email.configured ? (
        <Card className="p-4 mb-6 border-amber-500/40 bg-amber-500/5">
          <p className="text-sm font-medium">Email sending is not active yet</p>
          <p className="text-sm text-muted-foreground">
            In-app notifications still work. Emails are recorded as suppressed until a sender domain
            is verified.
          </p>
        </Card>
      ) : null}

      <div className="mb-6">
        <QueryState
          query={query}
          tone="admin"
          surface="admin/notifications"
          isEmpty={() => false}
          skeleton={
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          }
        >
          {() => null}
        </QueryState>
      </div>

      <DeliveryFailuresPanel />
    </div>
  );
}
