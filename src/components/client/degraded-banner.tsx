import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PanelStatus = {
  /** Human label for the panel, e.g. "Candidates by stage". */
  label: string;
  failed: boolean;
  /** Has data, but the data is known out of date. */
  stale?: boolean;
  /** Re-runs only this panel's query. */
  retry: () => void | Promise<unknown>;
};

function joinLabels(names: string[]): string {
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Inline marker for a single panel whose numbers cannot be trusted right now.
 * Sits next to the panel heading so the aggregate banner and the panel agree.
 */
export function NotCurrentChip({
  reason,
  className,
}: {
  reason?: string | null;
  className?: string;
}) {
  return (
    <span
      data-testid="not-current-chip"
      title={reason ?? undefined}
      className={`inline-flex items-center gap-1 rounded-full border taas-bd-warning taas-bg-warning-soft px-2 py-0.5 text-[11px] font-medium taas-fg-warning ${className ?? ""}`}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      Not current
    </span>
  );
}

/**
 * One aggregate signal for a multi-query page.
 *
 * A page that loads several independent panels must never show a partly-true
 * picture silently: if any panel failed, this banner names it and offers a
 * retry for everything that failed.
 */
export function DegradedPanelsBanner({
  panels,
  retrying = false,
}: {
  panels: PanelStatus[];
  retrying?: boolean;
}) {
  const failed = panels.filter((p) => p.failed);
  const stale = panels.filter((p) => !p.failed && p.stale);
  if (failed.length === 0 && stale.length === 0) return null;

  const affected = [...failed, ...stale];

  return (
    <div
      role="alert"
      data-testid="degraded-panels-banner"
      className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border taas-bd-warning taas-bg-warning-soft px-4 py-3 text-sm sm:flex sm:items-center"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 taas-fg-warning sm:mt-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          This page is incomplete.
          {failed.length > 0 && (
            <> {joinLabels(failed.map((p) => p.label))} didn&apos;t load.</>
          )}
          {stale.length > 0 && (
            <> {joinLabels(stale.map((p) => p.label))} {stale.length === 1 ? "is" : "are"} out of date.</>
          )}
        </p>
        <p className="text-muted-foreground">
          Those sections are marked &ldquo;not current&rdquo; below and show a dash instead of a
          figure — nothing here is a confirmed zero.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        disabled={retrying}
        onClick={() => {
          for (const panel of affected) void panel.retry();
        }}
        data-testid="degraded-panels-retry"
      >
        {retrying ? "Retrying…" : "Refresh these sections"}
      </Button>
    </div>
  );
}
