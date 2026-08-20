import { cn } from "@/lib/utils";
import { Coins, Info, TriangleAlert } from "lucide-react";
import type { CompensationSignal } from "@/lib/compensation-signal";

const ALIGNMENT_STYLE: Record<
  CompensationSignal["alignment"],
  { label: string; className: string }
> = {
  in_range: { label: "In range", className: "taas-bg-success-soft taas-fg-success" },
  above_range: { label: "Above range", className: "taas-bg-warning-soft taas-fg-warning" },
  below_range: { label: "Below range", className: "taas-bg-info-soft taas-fg-info" },
  unknown: { label: "Not comparable yet", className: "taas-bg-neutral-soft taas-fg-neutral" },
};

export function CompensationPanel({
  signal,
  loading,
  className,
}: {
  signal: CompensationSignal | null | undefined;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div className={cn("rounded-lg border bg-card p-4 text-sm text-muted-foreground", className)}>
        Loading compensation data…
      </div>
    );
  }
  if (!signal) return null;

  const a = ALIGNMENT_STYLE[signal.alignment];

  return (
    <section
      className={cn("rounded-lg border bg-card p-4", className)}
      aria-labelledby="comp-panel-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 id="comp-panel-title" className="text-sm font-semibold">
            Compensation
          </h2>
          {signal.location && (
            <span className="text-xs text-muted-foreground">{signal.location}</span>
          )}
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
            a.className,
          )}
        >
          {a.label}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{signal.alignmentNote}</p>

      {signal.dataQuality === "none" ? (
        <div className="mt-3 rounded-md border border-dashed bg-background/40 p-3 text-sm text-muted-foreground">
          Nothing on record yet. Add a range at intake or ask the candidate for their
          expectation — we won't fill the gap with an estimate.
        </div>
      ) : (
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {signal.figures.map((f) => (
            <div key={f.label} className="rounded-md border bg-background/40 p-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {f.label}
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {f.display ?? <span className="text-muted-foreground">Not shared</span>}
              </dd>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">{f.sourceLabel}</span>
                {f.thin && (
                  <span className="inline-flex items-center gap-1 rounded-full taas-bg-warning-soft taas-fg-warning px-1.5 py-0.5 text-[10px] font-semibold">
                    <TriangleAlert className="h-3 w-3" aria-hidden />
                    Thin data
                  </span>
                )}
              </div>
              {f.note && <p className="mt-1 text-[11px] text-muted-foreground">{f.note}</p>}
            </div>
          ))}
        </dl>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        {signal.disclaimer}
      </p>
    </section>
  );
}
