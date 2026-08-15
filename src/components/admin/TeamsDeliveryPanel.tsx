import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTeamsDeliveries } from "@/lib/teams.functions";
import { Badge } from "@/components/ui/badge";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

/**
 * Staff view of Microsoft Teams delivery: how many workspaces are connected,
 * how many posts failed, and the exact reason for each failure.
 */
export function TeamsDeliveryPanel() {
  const fn = useServerFn(listTeamsDeliveries);
  const query = useQuery({
    queryKey: ["teams-deliveries"],
    queryFn: () => fn(),
  });
  const { data } = query;

  return (
    <section className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Teams delivery</h3>
        {data ? (
          <div className="flex gap-2 text-xs">
            <Badge variant="secondary">{data.connected} connected</Badge>
            <Badge variant="secondary">{data.active} active</Badge>
            <Badge variant={data.failures > 0 ? "destructive" : "secondary"}>
              {data.failures} failed
            </Badge>
          </div>
        ) : null}
      </div>

      <PanelState
        query={query}
        className="mt-3"
        isEmpty={(data?.items.length ?? 0) === 0}
        empty={
          <PanelEmpty
            className="mt-3"
            title="No Teams posts yet"
            description="Nothing is sent until a workspace connects a channel."
          />
        }
      >
        <ul className="mt-3 divide-y text-sm">
          {data?.items.slice(0, 15).map((row) => (
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
                {new Date(row.created_at as string).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
              </div>
            </li>
          ))}
        </ul>
      </PanelState>
    </section>
  );
}
