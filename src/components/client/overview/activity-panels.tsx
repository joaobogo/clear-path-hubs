// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
import { Link } from "@tanstack/react-router";
import { MessageSquare, RefreshCw } from "lucide-react";
import { SectionHeader } from "./section-primitives";
import { relTime, formatAction } from "./utils";

import { Skeleton } from "@/components/ui/skeleton";

export function SinceLastVisit({
  events,
  fallback,
  lastSeen,
  loading,
}: {
  events: Any[];
  fallback: Any[];
  lastSeen: number | null;
  loading?: boolean;
}) {
  const list = events.length ? events : fallback.slice(0, 6);
  const isNew = (e: Any) => lastSeen != null && new Date(e.created_at).getTime() > lastSeen;
  const heading =
    lastSeen && events.length > 0
      ? `Since your last visit · ${events.length} update${events.length === 1 ? "" : "s"}`
      : "Recent activity";
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <SectionHeader icon={<RefreshCw className="h-4 w-4" />} title={heading} size="sm" />
      {loading ? (
        <div className="mt-3 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Hiring activity will appear here as your searches progress.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {list.slice(0, 8).map((e) => (
            <li key={e.id} className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  isNew(e) ? "bg-primary" : "bg-muted-foreground/40"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  {formatAction(String(e.action))}
                  {isNew(e) && (
                    <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      New
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{relTime(e.created_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RecentMessages({ messages, loading }: { messages: Any[]; loading?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          icon={<MessageSquare className="h-4 w-4" />}
          title="Recent messages"
          size="sm"
        />
        <Link
          to="/client/conversations"
          className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary hover:underline sm:min-h-0 sm:px-0"
        >
          View
        </Link>
      </div>
      {loading ? (
        <div className="mt-3 space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No recent messages.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {messages.slice(0, 4).map((m) => (
            <li key={m.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {(m.sender_name as string | undefined) ?? "TaaSFlow"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relTime(m.created_at)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
