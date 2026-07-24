import { useRouter } from "@tanstack/react-router";
import { ErrorState } from "@/components/ds/error-state";

interface GlobalErrorProps {
  error: Error;
  reset: () => void;
  info?: { componentStack?: string };
}

/**
 * Router-level default error boundary. Every route without an explicit
 * errorComponent falls back here. Copy is human-readable; the trace ID
 * (when present) lets support cross-reference logs without exposing the
 * raw stack.
 */
export function GlobalRouteError({ error, reset }: GlobalErrorProps) {
  const router = useRouter();
  const traceId =
    (error as Error & { traceId?: string }).traceId ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : undefined);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center px-4 py-16">
      <ErrorState
        title="Something interrupted this page"
        description="The page didn't finish loading. This is almost always a temporary hiccup — try again and it usually clears."
        traceId={traceId}
        onRetry={() => {
          router.invalidate();
          reset();
        }}
      />
    </div>
  );
}
