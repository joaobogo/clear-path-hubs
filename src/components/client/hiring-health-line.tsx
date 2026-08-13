import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotCurrentChip } from "@/components/client/degraded-banner";
import type { HiringHealth, HiringHealthFigureKey } from "@/lib/client-hiring-health";

/**
 * Hiring health line — replaces the counter wall at the top of the workspace.
 *
 * One sentence chosen by a fixed rule order, plus three plain figures that each
 * link to the list behind them. Loading, empty and error are three distinct
 * states: a failed load never renders as "on track".
 */

type FigureTarget = {
  to: string;
  search?: Record<string, string>;
};

function figureTarget(key: HiringHealthFigureKey, org?: string | null): FigureTarget {
  const orgPart: Record<string, string> = org ? { org } : {};

  switch (key) {
    case "open_roles":
      return { to: "/client/positions", search: { ...orgPart, status: "active" } };
    case "awaiting_decision":
      return { to: "/client/candidates", search: { ...orgPart, stage: "delivered" } };
    case "roles_without_shortlist":
      return {
        to: "/client/positions",
        search: { ...orgPart, status: "active", shortlist: "none" },
      };
  }
}

export function HiringHealthLine({
  health,
  notCurrent = false,
  notCurrentReason,
  loading,
  isError,
  onRetry,
  canSubmit,
  org,
  className,
}: {
  health: HiringHealth | null | undefined;
  /** Underlying query failed or is out of date — never show confident figures. */
  notCurrent?: boolean;
  notCurrentReason?: string | null;
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
  canSubmit: boolean;
  org?: string | null;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={cn("rounded-xl border bg-card px-4 py-4", className)}>
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <span className="sr-only">Loading your hiring summary</span>
      </div>
    );
  }

  // A partial or failed load must never read as "on track".
  if (isError || !health) {
    return (
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border taas-bd-warning taas-bg-warning-soft px-4 py-3",
          className,
        )}
        role="alert"
      >
        <p className="min-w-0 text-sm">
          <AlertTriangle className="mr-2 inline h-4 w-4 taas-fg-warning" aria-hidden="true" />
          We could not load your hiring summary.
        </p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  // A stale or partly failed load must not be read as a real zero.
  if (notCurrent) {
    return (
      <section
        aria-label="Hiring health"
        className={cn(
          "rounded-xl border taas-bd-warning taas-bg-warning-soft px-4 py-4",
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">Hiring summary</p>
          <NotCurrentChip reason={notCurrentReason} />
          <Button size="sm" variant="outline" className="ml-auto" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </Button>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {health.figures.map((f) => (
            <li key={f.key} className="inline-flex items-baseline gap-1.5 text-sm text-muted-foreground">
              <span className="text-lg font-semibold tabular-nums text-foreground">&mdash;</span>
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          {notCurrentReason ?? "This section is out of date"}, so figures are hidden rather than
          shown as zero.
        </p>
      </section>
    );
  }

  if (health.figures[0]!.value === 0) {
    return (
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border bg-card px-4 py-3",
          className,
        )}
      >
        <p className="min-w-0 text-sm font-medium">No roles open yet</p>
        {canSubmit ? (
          <Button size="sm" asChild>
            <Link to="/intake">Start a role</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const attention = health.tone === "attention";

  return (
    <section
      aria-label="Hiring health"
      className={cn(
        "rounded-xl border px-4 py-4",
        attention ? "taas-bd-warning taas-bg-warning-soft" : "bg-card",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-base font-semibold sm:text-lg" aria-live="polite">
        {attention ? (
          <AlertTriangle className="h-4 w-4 shrink-0 taas-fg-warning" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        )}
        {health.sentence}
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {health.figures.map((f) => {
          const target = figureTarget(f.key, org);
          return (
            <li key={f.key}>
              <Link
                to={target.to}
                search={target.search as never}
                className="group inline-flex items-baseline gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <span className="text-lg font-semibold tabular-nums text-foreground">{f.value}</span>
                <span className="group-hover:underline">{f.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
