import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Router-level error fallback used as `defaultErrorComponent` in src/router.tsx.
 * Intentionally minimal and dependency-light so it stays reachable even when
 * downstream modules fail to load.
 */
export function GlobalRouteError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();

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
        Something went wrong
      </h1>
      <p className="text-sm text-[color:var(--brand-navy,#0a1533)]/70">
        We hit an unexpected error loading this page. You can try again or head
        back to the homepage.
      </p>
      <div className="flex gap-3">
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
        <a
          href="/"
          className="rounded-md border border-[color:var(--brand-navy,#0a1533)]/20 px-4 py-2 text-sm font-medium text-[color:var(--brand-navy,#0a1533)] hover:bg-black/5"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
