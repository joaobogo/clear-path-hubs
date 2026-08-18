import { useEffect } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatStageDate,
  type RoleProgress,
} from "@/lib/client-role-progress";

/**
 * "Where we are" — the single stage tracker for a role.
 * Client language only: Briefed > Sourcing > Screening > Shortlist > Offer.
 *
 * Exactly one state per row (done | here now | upcoming) — the state comes from
 * the derived stage index, so a row can never read "Here now" and "Completed"
 * at the same time. A recorded date that precedes the stage before it is shown
 * as-is, with its duration relation withheld and a console warning raised for
 * admin repair rather than a fabricated "0 days after previous step".
 */
export function RoleProgressTracker({
  progress,
  size = "md",
  className,
}: {
  progress: RoleProgress | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const anomalies = progress?.anomalies ?? [];
  useEffect(() => {
    if (anomalies.length > 0) {
      // Surfaced for admin repair: the stored dates contradict the stage order.
      console.warn(
        `[role-progress] out-of-order stage dates need repair: ${anomalies.join(", ")}`,
      );
    }
  }, [anomalies.join(",")]);

  if (!progress) return null;
  const compact = size === "sm";

  return (
    <div className={cn("w-full", className)} aria-label="Role progress">
      <ol className="flex items-start gap-1.5">
        {progress.steps.map((step, i) => {
          const date = formatStageDate(step.enteredAt);
          return (
            <li key={step.key} className="min-w-0 flex-1">
              <div
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  // Completed reads as a settled, muted rail; the current stage
                  // is the only saturated bar on the row.
                  step.state === "done" && "bg-muted-foreground/35",
                  step.state === "current" &&
                    (progress.inactive ? "bg-muted-foreground/60" : "bg-primary"),
                  step.state === "upcoming" && "bg-border",
                )}
              />
              <div className="mt-1.5 min-w-0">
                <p
                  className={cn(
                    "flex items-center gap-1 truncate leading-tight",
                    compact ? "text-[10px]" : "text-xs",
                    step.state === "current"
                      ? "font-semibold text-foreground"
                      : step.state === "done"
                        ? "font-normal text-muted-foreground"
                        : "font-normal text-muted-foreground/60",
                  )}
                  title={step.hint}
                >
                  {step.state === "done" ? (
                    <Check className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                  ) : null}
                  <span className="truncate">{step.label}</span>
                </p>
                <p
                  className={cn(
                    "flex items-center gap-1 truncate leading-tight text-muted-foreground/70",
                    compact ? "text-[9px]" : "text-[10px]",
                  )}
                >
                  {step.dateAnomaly ? (
                    <AlertTriangle
                      className="h-2.5 w-2.5 shrink-0"
                      aria-label="Recorded date needs review"
                    />
                  ) : null}
                  {date || (step.state === "upcoming" ? "" : "—")}
                </p>
                <p
                  className={cn(
                    "truncate leading-tight tabular-nums",
                    step.state === "current"
                      ? "font-medium text-foreground/80"
                      : "text-muted-foreground/60",
                    compact ? "text-[9px]" : "text-[10px]",
                  )}
                >
                  {step.daysInStage == null
                    ? ""
                    : `${step.daysInStage}d${step.state === "current" ? " here" : ""}`}
                </p>
              </div>
              <span className="sr-only">
                {step.state === "current"
                  ? "Here now. "
                  : step.state === "done"
                    ? "Completed. "
                    : "Upcoming. "}
                {step.hint}
                {i === progress.steps.length - 1 ? "" : " "}
              </span>
            </li>
          );
        })}
      </ol>
      <p
        className={cn(
          "mt-2 font-medium text-muted-foreground",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        {progress.caption}
      </p>
      {anomalies.length > 0 && (
        <p
          className={cn(
            "mt-1 text-muted-foreground/80",
            compact ? "text-[9px]" : "text-[10px]",
          )}
        >
          One recorded date is out of order — we've flagged it for your TaaSFlow team to
          correct.
        </p>
      )}
    </div>
  );
}
