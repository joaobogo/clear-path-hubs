import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDeliveryFailures, retryFailedDelivery } from "@/lib/notifications.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

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

type DeliveryItem = {
  id: string;
  channel: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number | null;
  last_attempt_at: string | null;
  updated_at: string;
  notifications: {
    title: string;
    audience: string;
    recipient_user_id: string;
    event_type: string;
  } | null;
};

const STATUS_HELP: Record<string, string> = {
  failed: "The provider rejected or errored on this send. Safe to retry.",
  bounced: "The address rejected the message. Retrying will not help.",
  suppressed: "Blocked before sending (no email domain, or recipient opted out).",
};

function NotificationsPage() {
  const list = useServerFn(listDeliveryFailures);
  const retry = useServerFn(retryFailedDelivery);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "delivery-failures"],
    queryFn: () => list(),
    refetchOnWindowFocus: true,
  });

  const retryMut = useMutation({
    mutationFn: (deliveryId: string) => retry({ data: { deliveryId } }),
    onSuccess: () => {
      toast.success("Retry queued");
      qc.invalidateQueries({ queryKey: ["admin", "delivery-failures"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Retry failed"),
  });

  const items = (data?.items ?? []) as unknown as DeliveryItem[];
  const counts = (data?.counts ?? {}) as Record<string, number>;
  const email = data?.email as { configured: boolean; reason?: string | null } | undefined;

  const summary = [
    { label: "Emails sent (7d)", value: counts["email:sent"] ?? counts["email:delivered"] ?? 0 },
    { label: "Email failures (7d)", value: counts["email:failed"] ?? 0 },
    { label: "Suppressed (7d)", value: counts["email:suppressed"] ?? 0 },
    { label: "In-app delivered (7d)", value: counts["in_app:delivered"] ?? 0 },
  ];

  return (
    <main className="p-6 md:p-8 max-w-6xl">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {summary.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No delivery issues.</Card>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Audience</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">Detail</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-t align-top">
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(d.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 capitalize">{d.notifications?.audience ?? "—"}</td>
                  <td className="px-4 py-2">{d.notifications?.event_type ?? "—"}</td>
                  <td className="px-4 py-2">{d.channel}</td>
                  <td className="px-4 py-2">
                    <Badge variant={d.status === "bounced" ? "destructive" : "secondary"}>
                      {d.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 tabular-nums">{d.attempt_count ?? 0}</td>
                  <td className="px-4 py-2 text-xs max-w-[280px]">
                    {d.error_code ? <code>{d.error_code}</code> : null}{" "}
                    <span className="text-muted-foreground">
                      {d.error_message ?? STATUS_HELP[d.status] ?? ""}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {d.channel === "email" && d.status !== "bounced" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retryMut.isPending}
                        onClick={() => retryMut.mutate(d.id)}
                      >
                        Retry
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
