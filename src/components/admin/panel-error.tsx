/**
 * Inline failure state for admin panels.
 *
 * A panel that fails and renders nothing looks exactly like a panel with no
 * work in it — which is how staff end up trusting a false zero. This says the
 * read failed, and offers the retry in place.
 */
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PanelError({
  message = "We couldn't load this panel. This is a read failure on our side, not an empty result.",
  onRetry,
  retrying = false,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-danger-soft px-3 py-2.5",
        className,
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
          <RefreshCw
            className={cn("mr-1.5 h-3 w-3", retrying && "animate-spin motion-reduce:animate-none")}
            aria-hidden
          />
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      )}
    </div>
  );
}
