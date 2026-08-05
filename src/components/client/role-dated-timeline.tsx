import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimelineDate, type RoleTimeline } from "@/lib/client-role-timeline";
import { AlertCircle, Check } from "lucide-react";

/**
 * Dated role timeline. Real timestamps only — no percentages, no estimated
 * future dates, no internal recruiter tasks.
 */
export function RoleDatedTimeline({
  timeline,
  isLoading,
  error,
  onRetry,
  className,
}: {
  timeline: RoleTimeline | null | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  if (error) {
    return (
      <div className={cn("rounded-lg border border-destructive/40 bg-destructive/5 p-4", className)}>
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">Timeline unavailable</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              We could not load the dates for this role.
            </p>
            {onRetry && (
              <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !timeline) {
    return (
      <ol className={cn("space-y-3", className)} aria-busy="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </li>
        ))}
      </ol>
    );
  }

  if (timeline.empty) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Timeline starts once your brief is confirmed.
      </p>
    );
  }

  return (
    <ol className={cn("space-y-0", className)} aria-label="Role timeline">
      {timeline.steps.map((step, i) => {
        const last = i === timeline.steps.length - 1;
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  step.complete
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted",
                )}
                aria-hidden
              >
                {step.complete ? <Check className="h-3 w-3" /> : null}
              </span>
              {!last && (
                <span
                  className={cn("w-px flex-1", step.complete ? "bg-primary/40" : "bg-border")}
                  aria-hidden
                />
              )}
            </div>
            <div className={cn("min-w-0 pb-4", last && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium leading-tight",
                  step.complete ? "text-foreground" : "text-muted-foreground/70",
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatTimelineDate(step.at)}
                {step.daysFromPrevious != null && (
                  <span className="tabular-nums text-muted-foreground/80">
                    {" · "}
                    {step.daysFromPrevious} {step.daysFromPrevious === 1 ? "day" : "days"} after
                    previous step
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
