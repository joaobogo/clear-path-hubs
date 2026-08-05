import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Milestone } from "@/lib/client-next-milestone";

/**
 * "What happens next" — one line per active role, directly under the health
 * line, so the answer to "when do I see candidates?" is on screen.
 *
 * Shows at most four roles plus a link to the rest. A role with no stored
 * commitment says so in words instead of showing an estimate, and a passed date
 * is labelled "behind schedule" in text rather than by colour alone.
 */

export type MilestoneRow =
  | (Milestone & { error?: false })
  | { position_id: string; title: string; error: true };

const MAX_ROWS = 4;

export function NextMilestones({
  rows,
  totalRoles,
  loading,
  isError,
  onRetry,
  org,
}: {
  rows: MilestoneRow[] | null | undefined;
  totalRoles: number;
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
  org?: string | null;
}) {
  const search = org ? { org } : undefined;

  if (loading) {
    return (
      <section aria-labelledby="next-heading" className="rounded-xl border bg-card p-4 sm:p-5">
        <h2
          id="next-heading"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          What happens next
        </h2>
        <div className="mt-3 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
        <span className="sr-only">Loading what happens next on your roles</span>
      </section>
    );
  }

  if (isError) {
    return (
      <section
        aria-labelledby="next-heading"
        role="alert"
        className="rounded-xl border taas-bd-warning taas-bg-warning-soft p-4 sm:p-5"
      >
        <h2 id="next-heading" className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 taas-fg-warning" aria-hidden="true" />
          We could not load what happens next
        </h2>
        <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      </section>
    );
  }

  const list = rows ?? [];

  if (list.length === 0) {
    return (
      <section aria-labelledby="next-heading" className="rounded-xl border bg-card p-4 sm:p-5">
        <h2
          id="next-heading"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          What happens next
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No active roles yet. Dates appear here as soon as a role starts.
        </p>
      </section>
    );
  }

  const visible = list.slice(0, MAX_ROWS);
  const hidden = Math.max(0, (totalRoles || list.length) - visible.length);

  return (
    <section aria-labelledby="next-heading" className="rounded-xl border bg-card p-4 sm:p-5">
      <h2
        id="next-heading"
        className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        What happens next
      </h2>

      <ul className="mt-2 divide-y">
        {visible.map((row) => (
          <li key={row.position_id} className="py-2.5">
            {row.error ? (
              <p className="flex flex-wrap items-center gap-x-2 text-sm" role="alert">
                <span className="font-medium">{row.title}</span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 taas-fg-warning" aria-hidden="true" />
                  Next step could not be loaded for this role
                </span>
              </p>
            ) : (
              <Link
                to="/client/positions/$id"
                params={{ id: row.position_id }}
                search={search as never}
                className="group flex flex-wrap items-baseline gap-x-2 text-sm"
              >
                <span className="font-medium group-hover:text-primary">{row.title}</span>
                <span className="text-muted-foreground">— {row.text}</span>
                {row.behind_schedule && row.schedule_note ? (
                  <span className="font-medium taas-fg-warning">({row.schedule_note})</span>
                ) : null}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <Link
        to="/client/positions"
        search={search as never}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {hidden > 0 ? `See all ${totalRoles || list.length} roles` : "See all roles"}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
