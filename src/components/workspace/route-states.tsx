import { useEffect } from "react";
import { useRouter, useParams, Link, useSearch } from "@tanstack/react-router";
import { ErrorState, PermissionState } from "@/components/ds";
import { buttonVariants } from "@/components/ui/button";
import { normalizeError, logTechnical, type AudienceTone } from "@/lib/error-taxonomy";

const HOME: Record<AudienceTone, { to: string; label: string }> = {
  admin: { to: "/admin", label: "Back to overview" },
  client: { to: "/client", label: "Back to dashboard" },
  candidate: { to: "/me", label: "Go to my applications" },
  public: { to: "/", label: "Go home" },
};

/**
 * Recovery link rendered as a plain anchor (never a button wrapping a link),
 * so the very first activation navigates instead of only taking focus.
 */
function HomeLink({
  tone,
  search,
}: {
  tone: AudienceTone;
  search: Record<string, string | undefined> | undefined;
}) {
  return (
    <Link
      to={HOME[tone].to}
      search={search as any}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      {HOME[tone].label}
    </Link>
  );
}


/**
 * Section-level route error boundary. Any child route without its own
 * errorComponent lands here, so a failing page never blanks the workspace.
 * Copy tone follows the audience; technical detail stays in private logs.
 */
export function makeRouteErrorComponent(tone: AudienceTone, surface: string) {
  return function RouteError({ error, reset }: { error: Error; reset: () => void }) {
    const router = useRouter();
    const search = useSearch({ strict: false }) as Record<string, string | undefined>;
    const normalized = normalizeError(error, { tone });
    const linkSearch = search.org ? { org: search.org, preview: search.preview } : undefined;

    useEffect(() => {
      logTechnical(error, normalized, { surface });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error]);

    if (normalized.kind === "permission_denied") {
      // Never confirms whether the underlying record exists.
      return (
        <div className="p-6">
          <PermissionState
            title={normalized.title}
            description={normalized.description}
            action={
              <Button asChild variant="outline" size="sm">
                <Link to={HOME[tone].to} search={linkSearch as any}>{HOME[tone].label}</Link>
              </Button>
            }
          />
        </div>
      );
    }

    if (normalized.kind === "session_expired") {
      return (
        <div className="p-6">
          <ErrorState
            title={normalized.title}
            description={normalized.description}
            traceId={normalized.correlationId}
            action={
              <Button asChild size="sm">
                <Link to="/login">Sign in again</Link>
              </Button>
            }
          />
        </div>
      );
    }

    return (
      <div className="p-6">
        <ErrorState
          title={normalized.title}
          description={normalized.description}
          traceId={normalized.correlationId}
          onRetry={
            normalized.retryable
              ? () => {
                  router.invalidate();
                  reset();
                }
              : undefined
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={HOME[tone].to} search={linkSearch as any}>{HOME[tone].label}</Link>
            </Button>
          }
        />
      </div>
    );
  };
}

/**
 * Missing or deleted record — designed, never a blank page or raw 404.
 * Reads route params only (never loader data, which is undefined here) so it
 * can name the identifier the visitor actually asked for.
 */
export function makeRouteNotFoundComponent(tone: AudienceTone) {
  return function RouteNotFound() {
    const search = useSearch({ strict: false }) as Record<string, string | undefined>;
    const normalized = normalizeError({ status: 404 }, { tone });
    const linkSearch = search.org ? { org: search.org, preview: search.preview } : undefined;

    const params = useParams({ strict: false }) as Record<string, string | undefined>;
    const identifier = Object.values(params ?? {}).find(
      (value) => typeof value === "string" && value.length > 0,
    );
    return (
      <div className="p-6">
        <ErrorState
          title={normalized.title}
          description={
            identifier
              ? `${normalized.description} (requested: ${identifier})`
              : normalized.description
          }

          action={
            <Button asChild variant="outline" size="sm">
              <Link to={HOME[tone].to} search={linkSearch as any}>{HOME[tone].label}</Link>
            </Button>
          }
        />
      </div>
    );
  };
}
