import { useEffect, useMemo } from "react";
import { useRouter } from "@tanstack/react-router";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { describeError } from "@/lib/error-copy";

/**
 * Router-level error fallback used as `defaultErrorComponent` in src/router.tsx.
 * Intentionally minimal and dependency-light so it stays reachable even when
 * downstream modules fail to load. Raw technical errors are never shown; the
 * copy is audience-aware (admin / client / candidate / public) and always says
 * what happened and what to do next.
 */
export function GlobalRouteError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();

  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";

  const copy = useMemo(() => describeError(error, pathname), [error, pathname]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
    reportLovableError(error, { boundary: "router_default_error_component" });
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center"
    >
      <h1 className="text-2xl font-semibold text-[color:var(--brand-navy,#0a1533)]">
        {copy.title}
      </h1>
      <p className="text-sm text-[color:var(--brand-navy,#0a1533)]/70">
        {copy.body}
      </p>
      <p className="text-sm font-medium text-[color:var(--brand-navy,#0a1533)]">
        {copy.nextStep}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {copy.canRetry ? (
          <button
            type="button"
            onClick={() => {
              reset();
              router.invalidate();
            }}
            className="rounded-md bg-[color:var(--brand-navy,#0a1533)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Try again
          </button>
        ) : null}
        <a
          href={copy.homeHref}
          className="rounded-md border border-[color:var(--brand-navy,#0a1533)]/20 px-4 py-2 text-sm font-medium text-[color:var(--brand-navy,#0a1533)] hover:bg-black/5"
        >
          {copy.homeLabel}
        </a>
      </div>
      {copy.reference ? (
        <p className="text-xs text-[color:var(--brand-navy,#0a1533)]/50">
          Reference for support: {copy.reference}
        </p>
      ) : null}
    </div>
  );
}
