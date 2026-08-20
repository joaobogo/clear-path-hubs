import { useEffect, useState, type ReactNode } from "react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

function TimedFallback({
  timeoutMs,
  errorTitle,
  onRetry,
}: {
  timeoutMs: number;
  errorTitle: string;
  onRetry?: () => void;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(id);
  }, [timeoutMs]);

  if (timedOut) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="font-medium text-destructive">{errorTitle}</p>
            <p className="mt-1 text-muted-foreground">
              This section took too long to load. You can retry or continue using the rest of the page.
            </p>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setTimedOut(false);
                  onRetry();
                }}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-24 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

/**
 * Renders children inside a Suspense boundary with a hard timeout on the
 * fallback. If the child suspends for longer than `timeoutMs`, the skeleton
 * is replaced with an inline retryable error instead of hanging forever.
 */
export function DeferredBlock({
  children,
  fallback,
  timeoutMs = 10_000,
  errorTitle = "Could not load this section",
  onRetry,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  timeoutMs?: number;
  errorTitle?: string;
  onRetry?: () => void;
}) {
  return (
    <Suspense
      fallback={
        fallback ?? (
          <TimedFallback timeoutMs={timeoutMs} errorTitle={errorTitle} onRetry={onRetry} />
        )
      }
    >
      {children}
    </Suspense>
  );
}
