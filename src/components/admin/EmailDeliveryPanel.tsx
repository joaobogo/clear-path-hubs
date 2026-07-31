import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEmailDeliveryEvents } from "@/lib/email-delivery.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const { data, isLoading, error } = useQuery({
    queryKey: ["email-delivery", filter],
    queryFn: () => fn({ data: filter ? { eventType: filter } : {} }),
  });

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

      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading delivery history…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Delivery history is unavailable right now.
        </p>
      ) : !data?.available ? (
        <p className="mt-3 text-sm text-muted-foreground">{data?.reason}</p>
      ) : data.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No matching delivery events. Sends, bounces, complaints, unsubscribes and blocked
          sends will appear here as they happen.
        </p>
      ) : (
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
      )}

      {data?.available && data.historyStartsAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          History available from {new Date(data.historyStartsAt).toLocaleDateString()}. Delivered
          and opened outcomes are not recorded.
        </p>
      ) : null}
    </section>
  );
}
