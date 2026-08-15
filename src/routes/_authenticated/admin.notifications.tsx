import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDeliveryFailures } from "@/lib/notifications.functions";
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
  const list = useServerFn(listDeliveryFailures);

  const query = useQuery({
    queryKey: ["admin", "delivery-failures"],
    queryFn: () => list(),
    refetchOnWindowFocus: true,
  });

  const email = query.data?.email as { configured: boolean; reason?: string | null } | undefined;

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Delivery health</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Provider acceptance is not the same as inbox delivery. Anything failed,
          bounced or suppressed lands here.
        </p>
      </header>

      {email && !email.configured ? (
        <Card className="p-4 mb-6 border-amber-500/40 bg-amber-500/5">
          <p className="text-sm font-medium">Email sending is not active yet</p>
          <p className="text-sm text-muted-foreground">
            In-app notifications still work. Emails are recorded as suppressed until a
            sender domain is verified.
          </p>
        </Card>
      ) : null}

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
        {(data) => {
          const counts = (data.counts ?? {}) as Record<string, number>;
          const summary = [
            { label: "Emails sent (7d)", value: counts["email:provider_accepted"] ?? 0 },
            { label: "Email failures (7d)", value: (counts["email:failed"] ?? 0) + (counts["email:bounced"] ?? 0) },
            { label: "Suppressed (7d)", value: counts["email:suppressed"] ?? 0 },
            { label: "In-app delivered (7d)", value: counts["in_app:delivered"] ?? 0 },
          ];
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {summary.map((s) => (
                <Card key={s.label} className="p-4">
                  <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </Card>
              ))}
            </div>
          );
        }}
      </QueryState>

      <DeliveryFailuresPanel />
    </div>
  );
}
