import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getActivityFeed } from "@/lib/activity.functions";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

export const ACTIVITY_QUERY_KEY = ["activity-feed"] as const;

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE, day: "numeric", month: "short" });
}

function absTime(iso: string): string {
  // Rendered in the viewer's own timezone; stored and transported as UTC.
  return new Date(iso).toLocaleString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Role-scoped activity. Every row comes from the single canonical event table,
 * filtered by RLS and by the audience gate in `src/lib/events.ts`.
 * When nothing has happened, it says so — it never invents activity.
 */
export function ActivityFeed(props: {
  organizationId?: string;
  positionId?: string;
  candidateMatchId?: string;
  limit?: number;
  title?: string;
  className?: string;
}) {
  const fetchFeed = useServerFn(getActivityFeed);
  const { organizationId, positionId, candidateMatchId, limit = 12 } = props;

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      ...ACTIVITY_QUERY_KEY,
      organizationId ?? null,
      positionId ?? null,
      candidateMatchId ?? null,
      limit,
    ],
    queryFn: () =>
      fetchFeed({
        data: {
          organization_id: organizationId,
          position_id: positionId,
          candidate_match_id: candidateMatchId,
          limit,
        },
      }),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });


  return (
    <section className={`flex h-full flex-col rounded-xl border bg-card p-5 ${props.className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {props.title ?? "Activity"}
        </h2>
        {data?.fetched_at && data.entries.length > 0 ? (
          <span className="text-[11px] text-muted-foreground" title={absTime(data.fetched_at)}>
            Updated {relTime(data.fetched_at)}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
      ) : isError ? (
        <p className="mt-4 text-sm text-muted-foreground">Activity is unavailable right now.</p>
      ) : !data || data.entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className={`mt-3 divide-y relative transition-opacity ${isFetching && !isLoading ? "opacity-50" : ""}`}>
          {isFetching && !isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {(() => {
            const groups: typeof data.entries = [];
            let last: (typeof data.entries)[0] | null = null;
            let count = 0;

            for (const e of data.entries) {
              const isRepeat =
                last &&
                e.event_type === last.event_type &&
                e.label === last.label &&
                e.actor_name === last.actor_name &&
                e.position_title === last.position_title;

              if (isRepeat) {
                count++;
              } else {
                if (last) groups.push({ ...last, label: count > 0 ? `${last.label} (${count + 1} events)` : last.label });
                last = e;
                count = 0;
              }
            }
            if (last) groups.push({ ...last, label: count > 0 ? `${last.label} (${count + 1} events)` : last.label });

            return groups.map((e) => {
              const body = (
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{e.label}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[e.position_title, e.actor_name].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <time
                    className="shrink-0 pt-0.5 text-[11px] text-muted-foreground"
                    dateTime={e.occurred_at}
                    title={absTime(e.occurred_at)}
                  >
                    {relTime(e.occurred_at)}
                  </time>
                </div>
              );
              return (
                <li key={e.event_id}>
                  {e.link_path ? (
                    <Link to={e.link_path} className="block hover:text-primary">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            });
          })()}
        </ol>
      )}
    </section>
  );
}
