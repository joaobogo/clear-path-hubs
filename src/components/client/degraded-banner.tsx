import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PanelStatus = {
  /** Human label for the panel, e.g. "Pipeline". */
  label: string;
  failed: boolean;
  /** Re-runs only this panel's query. */
  retry: () => void | Promise<unknown>;
};

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
  if (failed.length === 0) return null;

  const names = failed.map((p) => p.label);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return (
    <div
      role="alert"
      data-testid="degraded-panels-banner"
      className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border taas-bd-warning taas-bg-warning-soft px-4 py-3 text-sm sm:flex sm:items-center"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 taas-fg-warning sm:mt-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          This page is incomplete — {list} {failed.length === 1 ? "didn't load" : "didn't load"}.
        </p>
        <p className="text-muted-foreground">
          Counts and lists below exclude that data, so treat them as partial until it loads.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        disabled={retrying}
        onClick={() => {
          for (const panel of failed) void panel.retry();
        }}
        data-testid="degraded-panels-retry"
      >
        {retrying ? "Retrying…" : "Retry failed panels"}
      </Button>
    </div>
  );
}
