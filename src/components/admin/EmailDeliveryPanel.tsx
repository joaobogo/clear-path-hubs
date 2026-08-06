import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEmailDeliveryEvents } from "@/lib/email-delivery.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";

const FILTERS = [
  { value: "", label: "Everything" },
  { value: "bounced", label: "Bounces" },
  { value: "complained", label: "Complaints" },
  { value: "unsubscribed", label: "Unsubscribes" },
  { value: "suppressed", label: "Suppressed" },
  { value: "rate_limited", label: "Rate limited" },
  { value: "rejected", label: "Rejected" },
] as const;

const PROBLEM_EVENTS = new Set([
  "bounced",
  "complained",
  "suppressed",
  "rate_limited",
  "rejected",
]);

/**
 * Staff view of email delivery. Nothing is allowed to fail silently: every
 * bounce, complaint, unsubscribe, suppressed and rate-limited send is listed
 * with the recipient and who they are to us.
 */
export function EmailDeliveryPanel() {
  const [filter, setFilter] = useState<string>("");
  const fn = useServerFn(listEmailDeliveryEvents);
  const query = useQuery({
    queryKey: ["email-delivery", filter],
    queryFn: () => fn({ data: filter ? { eventType: filter } : {} }),
  });
  const { data } = query;

  const problems = data?.available
    ? data.items.filter((i) => PROBLEM_EVENTS.has(i.eventType)).length
    : 0;

  return (
    <section className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Email delivery</h3>
        {data?.available ? (
          <div className="flex gap-2 text-xs">
            <Badge variant="secondary">{data.items.length} events</Badge>
            <Badge variant={problems > 0 ? "destructive" : "secondary"}>
              {problems} needing attention
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <PanelState
        query={query}
        className="mt-3"
        isEmpty={!!data?.available && data.items.length === 0}
        empty={
          <PanelEmpty
            className="mt-3"
            title="No matching delivery events"
            description="Sends, bounces, complaints, unsubscribes and blocked sends will appear here as they happen."
          />
        }
      >
        {data?.available ? (
          <ul className="mt-3 divide-y text-sm">
            {data.items.slice(0, 40).map((row, i) => (
              <li
                key={`${row.messageId ?? "e"}-${row.timestamp}-${i}`}
                className="flex items-start justify-between gap-4 py-2"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {row.who ?? row.recipient}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {row.role}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.recipient}
                    {row.status ? ` — ${row.status}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant={PROBLEM_EVENTS.has(row.eventType) ? "destructive" : "secondary"}>
                    {row.eventType.replace(/_/g, " ")}
                  </Badge>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(row.timestamp).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{data?.reason}</p>
        )}
      </PanelState>

      {data?.available && data.historyStartsAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          History available from {new Date(data.historyStartsAt).toLocaleDateString()}. Delivered
          and opened outcomes are not recorded.
        </p>
      ) : null}
    </section>
  );
}
