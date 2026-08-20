import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * A skeleton that automatically turns into a retryable error after a timeout.
 * Use inside route `pendingComponent` or inside any Suspense fallback so a
 * stuck loader never leaves the user staring at a spinner forever.
 */
export function SkeletonTimeout({
  children,
  timeoutMs = 10_000,
  onRetry,
  label = "Loading…",
}: {
  children?: ReactNode;
  timeoutMs?: number;
  onRetry?: () => void;
  label?: string;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(id);
  }, [timeoutMs]);

  if (timedOut) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
        <p className="mt-3 text-sm font-medium text-destructive">This page took too long to load</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          The data is taking longer than expected. Try again or check your connection.
        </p>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
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
    );
  }

  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
