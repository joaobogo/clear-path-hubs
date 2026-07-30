import { cn } from "@/lib/utils";
import {
  formatStageDate,
  type RoleProgress,
} from "@/lib/client-role-progress";

/**
 * "Where we are" — a persistent five-stage tracker for a role.
 * Client language only: Briefed > Sourcing > Screening > Shortlist > Offer.
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
                  step.state === "done" && "bg-primary/45",
                  step.state === "current" &&
                    (progress.inactive ? "bg-muted-foreground/60" : "bg-primary"),
                  step.state === "upcoming" && "bg-border",
                )}
              />
              <div className="mt-1.5 min-w-0">
                <p
                  className={cn(
                    "truncate font-medium leading-tight",
                    compact ? "text-[10px]" : "text-xs",
                    step.state === "current"
                      ? "text-foreground"
                      : step.state === "done"
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60",
                  )}
                  title={step.hint}
                >
                  {step.label}
                </p>
                <p
                  className={cn(
                    "truncate leading-tight text-muted-foreground/70",
                    compact ? "text-[9px]" : "text-[10px]",
                  )}
                >
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
                {step.state === "current" ? "Current stage. " : ""}
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
    </div>
  );
}
