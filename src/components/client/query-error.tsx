import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The single error surface for every client list and detail route.
 *
 * Rules (do not work around these):
 *  - A failed query NEVER renders an empty state or zero counts.
 *  - The failure reason is always shown, in plain language.
 *  - Retry re-runs only the failed query and is disabled while in flight.
 *  - No toast-only errors, no silent retries.
 */

/** Turn an unknown thrown value into one plain, client-safe line. */
export function queryErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "";

  const message = raw.trim();
  if (!message) return "The request failed before it returned anything.";

  const lower = message.toLowerCase();
  if (lower.includes("unauthorized") || lower.includes("401") || lower.includes("jwt")) {
    return "Your session expired while loading this. Retry, or sign in again.";
  }
  if (lower.includes("permission") || lower.includes("row-level security") || lower.includes("403")) {
    return "This workspace didn't allow the request. Your access may have changed.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request failed")) {
    return "We couldn't reach the server. Check your connection and retry.";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "The request took too long and was stopped.";
  }
  // Raw database/driver text is never client-safe: log it, show a plain line.
  const technical =
    /column .* does not exist|relation .* does not exist|syntax error|postgres|pgrst|schema cache|violates .* constraint|function .* does not exist|invalid input syntax|\bselect\b .*\bfrom\b/i;
  if (technical.test(message)) {
    if (typeof console !== "undefined") console.error("[query-error]", message);
    return "We couldn't load this. Try again, or contact support if it keeps happening.";
  }
  // Keep it short — never dump a stack or a giant payload into the UI.
  return message.length > 240 ? `${message.slice(0, 237)}…` : message;
}

export function QueryErrorCard({
  title = "We couldn't load this",
  error,
  onRetry,
  retrying = false,
  className,
  compact = false,
}: {
  title?: string;
  error: unknown;
  /** Must re-run only the failed query. */
  onRetry?: () => void | Promise<unknown>;
  retrying?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const [localRetrying, setLocalRetrying] = useState(false);
  const inFlight = retrying || localRetrying;

  const handleRetry = useCallback(async () => {
    if (!onRetry || inFlight) return;
    setLocalRetrying(true);
    try {
      await onRetry();
    } finally {
      setLocalRetrying(false);
    }
  }, [onRetry, inFlight]);

  return (
    <div
      role="alert"
      data-testid="query-error"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 text-left",
        compact ? "p-4" : "p-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <p className="mt-1 break-words text-sm text-muted-foreground">{queryErrorMessage(error)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nothing is lost — this is a load failure, not an empty result.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {onRetry && (
              <Button size="sm" onClick={handleRetry} disabled={inFlight} data-testid="query-error-retry">
                {inFlight ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Retrying…
                  </>
                ) : (
                  "Retry"
                )}
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link to="/client/conversations">Tell your recruiter</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders exactly one of loading / error / empty / ready. Because the branches
 * live here, a route cannot accidentally fall through to the empty state.
 */
export function QueryView<TData>({
  query,
  isEmpty,
  loading,
  empty,
  errorTitle,
  children,
  className,
}: {
  query: {
    data: TData | undefined;
    isPending?: boolean;
    isLoading?: boolean;
    isError: boolean;
    isFetching?: boolean;
    error?: unknown;
    refetch?: () => unknown;
  } & {
  };
  /** Decide emptiness from loaded data only. */
  isEmpty?: (data: TData) => boolean;
  loading: ReactNode;
  empty?: ReactNode;
  errorTitle?: string;
  children: (data: TData) => ReactNode;
  className?: string;
}) {
  if (query.isError) {
    return (
      <QueryErrorCard
        className={className}
        title={errorTitle}
        error={query.error}
        onRetry={query.refetch ? () => void query.refetch!() : undefined}
        retrying={Boolean(query.isFetching)}
      />
    );
  }

  const pending = query.isPending ?? query.isLoading ?? query.data === undefined;
  if (pending || query.data === undefined) return <>{loading}</>;

  if (empty && isEmpty?.(query.data)) return <>{empty}</>;

  return <>{children(query.data)}</>;
}
