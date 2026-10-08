import { useEffect } from "react";
import { useRouter, useParams, Link, useSearch, type ErrorComponentProps } from "@tanstack/react-router";
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
 * The recovery link must not hand back the value that just failed.
 *
 * On a search-validation failure TanStack leaves the RAW query on the match,
 * so `useSearch({ strict: false })` still returns the junk `?org=`. "Back to
 * dashboard" then rebuilt the same broken URL and the page failed again — a
 * loop with no way out but editing the address bar (audit 16 Sep, finding 10).
 */
const WORKSPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function workspaceLinkSearch(
  search: Record<string, string | undefined>,
): { org: string; preview: string | undefined } | undefined {
  if (!search.org || !WORKSPACE_ID.test(search.org)) return undefined;
  return { org: search.org, preview: search.preview };
}

/**
 * Section-level route error boundary. Any child route without its own
 * errorComponent lands here, so a failing page never blanks the workspace.
 * Copy tone follows the audience; technical detail stays in private logs.
 */
export function makeRouteErrorComponent(tone: AudienceTone, surface: string) {
  return function RouteError({ error, reset }: ErrorComponentProps) {
    const router = useRouter();
    const search = useSearch({ strict: false }) as Record<string, string | undefined>;
    const normalized = normalizeError(error, { tone });
    const linkSearch = workspaceLinkSearch(search);

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
            action={<HomeLink tone={tone} search={linkSearch} />}
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
              <Link to="/login" className={buttonVariants({ size: "sm" })}>
                Sign in again
              </Link>
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
          action={<HomeLink tone={tone} search={linkSearch} />}
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
    const linkSearch = workspaceLinkSearch(search);

    const params = useParams({ strict: false }) as Record<string, string | undefined>;
    const identifier = Object.values(params ?? {}).find(
      (value) => typeof value === "string" && value.length > 0,
    );

    // Unknown routes → neutral "page not found". Missing records (URL has an
    // identifier) → "no longer available" so the copy matches reality.
    //
    // The DESCRIPTION already branched this way; the TITLE did not, and the
    // taxonomy's admin 404 title is record-flavoured. So /admin/missing-evidence
    // — a mistyped route, no record requested — headlined "We couldn't find that
    // record" and, in the admin voice, "It may have been archived, merged, or
    // deleted", inviting staff to go hunting for data loss that never happened
    // (audit 1 Sep, F34). On a platform whose audit history is entirely about
    // numbers disagreeing, a spurious "deleted" is an expensive false alarm.
    const title = identifier ? normalized.title : "We couldn't find that page";

    const description =
      tone === "public"
        ? normalized.description
        : identifier
          ? tone === "client"
            ? "This item is no longer available in your workspace."
            : normalized.description
          : "We couldn't find that page.";

    return (
      <div className="p-6">
        <ErrorState
          title={title}
          description={description}
          action={<HomeLink tone={tone} search={linkSearch} />}
        />
      </div>
    );
  };
}
