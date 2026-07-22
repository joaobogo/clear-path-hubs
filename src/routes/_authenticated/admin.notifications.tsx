import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDeliveryFailures } from "@/lib/notifications.functions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Delivery health · TaaSFlow" },
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
  updated_at: string;
  notifications: {
    title: string;
    audience: string;
    recipient_user_id: string;
    event_type: string;
  } | null;
};

function NotificationsPage() {
  const list = useServerFn(listDeliveryFailures);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "delivery-failures"],
    queryFn: () => list(),
    refetchOnWindowFocus: true,
  });

  const items = ((data?.items ?? []) as unknown) as DeliveryItem[];

  return (
    <main className="p-8 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Delivery health</h1>
        <p className="text-sm text-muted-foreground">
          Provider acceptance is not the same as inbox delivery. Anything failed,
          bounced or suppressed lands here.
        </p>
      </header>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No delivery issues.</Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Audience</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(d.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 capitalize">{d.notifications?.audience}</td>
                  <td className="px-4 py-2">{d.notifications?.event_type}</td>
                  <td className="px-4 py-2">{d.channel}</td>
                  <td className="px-4 py-2">
                    <Badge variant="destructive">{d.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {d.error_code ? <code>{d.error_code}</code> : null}{" "}
                    <span className="text-muted-foreground">{d.error_message}</span>
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
