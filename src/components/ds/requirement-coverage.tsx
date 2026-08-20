import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Requirement coverage visual. Renders whichever coverage counts the caller
 * passes in — does not query, aggregate, or infer coverage. When `items` is
 * provided, each requirement's status is passed through verbatim; no
 * business logic here.
 */

export type CoverageStatus = "met" | "partial" | "unmet";

export interface RequirementItem {
  label: string;
  status: CoverageStatus;
  detail?: string;
}

export interface RequirementCoverageProps {
  met: number;
  partial?: number;
  unmet: number;
  total?: number;
  className?: string;
  compact?: boolean;
  items?: RequirementItem[];
}

const statusColor: Record<CoverageStatus, string> = {
  met: "var(--taas-status-success)",
  partial: "var(--taas-status-warning)",
  unmet: "var(--taas-status-danger)",
};

const statusIcon: Record<CoverageStatus, typeof CheckCircle2> = {
  met: CheckCircle2,
  partial: MinusCircle,
  unmet: XCircle,
};

const statusLabel: Record<CoverageStatus, string> = {
  met: "Met",
  partial: "Partial",
  unmet: "Not met",
};

export function RequirementCoverage({
  met,
  partial = 0,
  unmet,
  total,
  className,
  compact,
  items,
}: RequirementCoverageProps) {
  const denom = total ?? met + partial + unmet;
  const safeDenom = Math.max(denom, 1);
  const metPct = (met / safeDenom) * 100;
  const partialPct = (partial / safeDenom) * 100;
  const unmetPct = 100 - metPct - partialPct;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground tabular-nums">
          {met}/{denom || 0} met
        </span>
        {partial > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {partial} partial · {unmet} not met
          </span>
        ) : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {unmet} not met
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(metPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Requirement coverage: ${met} of ${denom || 0} met`}
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <span style={{ width: `${metPct}%`, backgroundColor: statusColor.met }} />
        <span style={{ width: `${partialPct}%`, backgroundColor: statusColor.partial }} />
        <span style={{ width: `${unmetPct}%`, backgroundColor: statusColor.unmet }} />
      </div>
      {!compact && items && items.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {items.map((it, i) => {
            const Icon = statusIcon[it.status];
            const color = statusColor[it.status];
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
                <div className="min-w-0">
                  <div className="text-foreground">{it.label}</div>
                  {it.detail ? (
                    <div className="text-xs text-muted-foreground">{it.detail}</div>
                  ) : null}
                </div>
                <span className="sr-only">{statusLabel[it.status]}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
