import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  traceId?: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

/**
 * Brand-consistent error surface. Copy is written for humans, not stack traces.
 * Trace IDs are visible but never scary. Retry is always one click away.
 */
export function ErrorState({
  title = "We couldn't load this just now",
  description = "This is on our side, not yours. Give it another try — your work is safe.",
  traceId,
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "motion-surface flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-danger-soft px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {traceId ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground/80">
          Reference: {traceId}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-2">
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}
