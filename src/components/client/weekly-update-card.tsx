import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getWeeklyUpdate } from "@/lib/client-weekly-update.functions";
import {
  formatWaitingSince,
  formatWindow,
  type WeeklyUpdate,
} from "@/lib/client-weekly-update";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * "This week" — the same object the weekly email renders, so the numbers on
 * screen and in the inbox are identical. Counted events only; a quiet week says
 * so rather than being hidden.
 */
export function WeeklyUpdateCard({ orgId }: { orgId: string }) {
  const fn = useServerFn(getWeeklyUpdate);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["client-weekly-update", orgId],
    queryFn: () => fn({ data: { orgId } }),
    placeholderData: (prev) => prev,
  });

  if (isLoading && !data) {
    return (
      <section aria-label="This week" className="rounded-xl border bg-card p-4">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-4 h-4 w-2/3" />
      </section>
    );
  }

  if (isError && !data) {
    return (
      <section
        aria-label="This week"
        className="rounded-xl border bg-card p-4"
        role="alert"
      >
        <h2 className="text-lg font-semibold">This week</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We could not load this week&apos;s update.
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
          Try again
        </Button>
      </section>
    );
  }

  if (!data) return null;
  const update: WeeklyUpdate = data;

  return (
    <section aria-label="This week" className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">This week</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatWindow(update)}
          {isFetching ? " · updating" : ""}
        </span>
      </div>

      {update.no_movement ? (
        <div className="mt-3 rounded-lg border border-dashed p-4">
          <p className="text-sm font-medium">No movement this week</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {update.no_movement_reason
              ? `Nothing progressed because ${update.no_movement_reason}.`
              : "No candidates were delivered, no interviews were held and no decisions were recorded."}
          </p>
        </div>
      ) : (
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {update.metrics.map((m) => (
            <div key={m.key} className="rounded-lg border p-3">
              <dd className="text-2xl font-semibold tabular-nums">{m.count}</dd>
              <dt className="mt-0.5 text-sm text-muted-foreground">{m.label}</dt>
              {m.roles.length > 0 && (
                <p className="mt-1 truncate text-xs text-muted-foreground" title={m.roles.join(", ")}>
                  {m.roles.join(", ")}
                </p>
              )}
            </div>
          ))}
        </dl>
      )}

      {update.awaiting_client.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">Waiting on you</h3>
          <ul className="mt-2 divide-y rounded-lg border">
            {update.awaiting_client.map((r) => (
              <li key={r.position_id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.reason}
                    {formatWaitingSince(r.waiting_since)
                      ? ` · ${formatWaitingSince(r.waiting_since)}`
                      : ""}
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/client/positions/$id" params={{ id: r.position_id }}>
                    Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {update.next_week.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium">What we do next week</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {update.next_week.map((n, i) => (
              <li key={`${n.position_id ?? "all"}-${i}`}>
                {n.title ? `${n.title}: ` : ""}
                {n.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
