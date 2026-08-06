import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTeamsDeliveries } from "@/lib/teams.functions";
import { Badge } from "@/components/ui/badge";
import { PanelError } from "@/components/admin/panel-error";

/**
 * Staff view of Microsoft Teams delivery: how many workspaces are connected,
 * how many posts failed, and the exact reason for each failure.
 */
export function TeamsDeliveryPanel() {
  const fn = useServerFn(listTeamsDeliveries);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["teams-deliveries"],
    queryFn: () => fn(),
  });

  if (isLoading) {
    return (
      <section className="rounded-lg border p-4">
        <h3 className="font-semibold">Teams delivery</h3>
        <p className="mt-1 text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }
  if (error || !data) {
    return (
      <section className="rounded-lg border p-4">
        <h3 className="font-semibold">Teams delivery</h3>
        <PanelError
          className="mt-3"
          message="We couldn't load Teams delivery history. This is a read failure, not proof that nothing was posted."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Teams delivery</h3>
        <div className="flex gap-2 text-xs">
          <Badge variant="secondary">{data.connected} connected</Badge>
          <Badge variant="secondary">{data.active} active</Badge>
          <Badge variant={data.failures > 0 ? "destructive" : "secondary"}>
            {data.failures} failed
          </Badge>
        </div>
      </div>

      {data.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No Teams posts yet. Nothing is sent until a workspace connects a channel.
        </p>
      ) : (
        <ul className="mt-3 divide-y text-sm">
          {data.items.slice(0, 15).map((row) => (
            <li key={row.id as string} className="flex items-start justify-between gap-4 py-2">
              <div className="min-w-0">
                <div className="font-medium">
                  {String(row.event_type ?? "event").replace(/_/g, " ")}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {row.status === "delivered"
                    ? "Delivered"
                    : `${row.error_code ?? "failed"}${row.error_message ? ` — ${row.error_message}` : ""}`}
                </div>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {new Date(row.created_at as string).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
