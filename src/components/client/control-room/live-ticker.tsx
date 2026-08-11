import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getLiveFeed, type LiveEvent } from "@/lib/control-room.functions";
import { shortAgo } from "@/lib/control-room-shared";
import { cn } from "@/lib/utils";

const KIND_DOT: Record<string, string> = {
  candidate: "bg-sky-500",
  stage: "bg-violet-500",
  reply: "bg-emerald-500",
  interview: "bg-amber-500",
  offer: "bg-primary",
  role: "bg-muted-foreground/60",
  other: "bg-muted-foreground/40",
};

/**
 * Prompt 20 — real movement, live, without noise.
 * New candidates, stage changes, replies and bookings appear as they happen.
 * A new arrival is marked briefly so nobody has to hunt for what changed.
 */
export function LiveTicker({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const feedFn = useServerFn(getLiveFeed);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["live-feed", orgId],
    queryFn: () => feedFn({ data: { organization_id: orgId } }),
    refetchInterval: 120_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`live-ticker-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification_events",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["live-feed", orgId] });
          qc.invalidateQueries({ queryKey: ["system-status", orgId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);

  // Mark anything we have not shown before as new, then let it settle.
  // The very first load is not "new" — it is just the current picture.
  useEffect(() => {
    if (!data) return;
    const firstLoad = seen.current.size === 0;
    const incoming = data.filter((e) => !seen.current.has(e.id)).map((e) => e.id);
    data.forEach((e) => seen.current.add(e.id));
    if (firstLoad || incoming.length === 0) return;
    setFreshIds(new Set(incoming));
    const t = setTimeout(() => setFreshIds(new Set()), 6000);
    return () => clearTimeout(t);
  }, [data]);

  if (isPending) {
    return <div className="h-40 animate-pulse rounded-lg border border-border bg-muted/40" />;
  }

  return (
    <section
      aria-label="Live movement"
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Live movement</h2>
        <span className="text-xs text-muted-foreground">Updates as it happens</span>
      </div>

      {isError ? (
        // A failed read is never shown as "nothing moved" — that reads as an
        // all-clear the data doesn't support.
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            We couldn't load recent movement. This is a loading problem on our side, not
            a quiet day — activity may have happened that we can't show yet.
          </p>
          <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      ) : !data?.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing has moved yet today. When a candidate arrives, a stage changes
          or an interview is booked, it will show here.
        </p>

      ) : (
        <ul aria-live="polite" className="mt-3 space-y-2">
          {data.map((e: LiveEvent) => (
            <li
              key={e.id}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                freshIds.has(e.id) && "bg-primary/5",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  KIND_DOT[e.kind] ?? KIND_DOT.other,
                )}
              />
              <span className="truncate">
                {e.sentence}
                {e.role_title ? (
                  <span className="text-muted-foreground"> · {e.role_title}</span>
                ) : null}
              </span>
              {freshIds.has(e.id) && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  New
                </span>
              )}
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {shortAgo(e.occurred_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
