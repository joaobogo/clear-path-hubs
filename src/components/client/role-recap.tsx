// Role recap for a closed role on /client/positions/$id.
//
// One screen, no charts, no scrolling on a laptop: a duration list, three
// counts, and the decline reasons the client themselves recorded. A figure with
// no underlying event reads "Not recorded" — never 0.

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, formatDuration, type RoleRecap } from "@/lib/role-recap";

export function RoleRecapSkeleton() {
  return (
    <section className="rounded-xl border p-4 sm:p-5">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-4 w-2/3" />
          ))}
        </div>
      </div>
    </section>
  );
}

export function RoleRecapError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden />
        <div className="space-y-2">
          <p className="text-sm font-medium">We could not load the recap for this role.</p>
          <p className="text-sm text-muted-foreground">
            Nothing is lost — the recorded activity is still there.
          </p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden />
            Retry
          </Button>
        </div>
      </div>
    </section>
  );
}

export function RoleRecapPanel({ recap }: { recap: RoleRecap }) {
  if (!recap.hasActivity) {
    return (
      <section className="rounded-xl border p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Role recap</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Not enough recorded activity for a recap.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Role recap</h2>
        <p className="text-xs text-muted-foreground">
          From recorded activity on this role only.
        </p>
      </div>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            How long it took
          </h3>
          <dl className="mt-2 divide-y">
            {recap.durations.map((d) => (
              <div key={d.key} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-sm text-muted-foreground">{d.label}</dt>
                <dd
                  className={
                    d.days === null
                      ? "text-sm text-muted-foreground"
                      : "text-sm font-medium tabular-nums"
                  }
                >
                  {formatDuration(d.days)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Candidates
            </h3>
            <dl className="mt-2 divide-y">
              {recap.counts.map((c) => (
                <div key={c.key} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-sm text-muted-foreground">{c.label}</dt>
                  <dd
                    className={
                      c.value === null
                        ? "text-sm text-muted-foreground"
                        : "text-sm font-medium tabular-nums"
                    }
                  >
                    {formatCount(c.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your top decline reasons
            </h3>
            {recap.declineReasons.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Not recorded</p>
            ) : (
              <ol className="mt-2 space-y-1.5">
                {recap.declineReasons.map((r) => (
                  <li key={r.code} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
