import { createFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

/**
 * Intentional access-denied state for protected routes that fail closed.
 *
 * `reason` distinguishes the two failure modes so the user gets an actionable
 * message instead of a generic bounce:
 *  - `membership`   — the account has no active workspace membership at all.
 *  - `organization` — the account is signed in, but is not a member of the
 *                     organization it tried to open (direct URL / stale link).
 *
 * No case signs the user out automatically: a denied route must never destroy
 * an otherwise-valid session (that logged users out of every area at once).
 * The `membership` case offers an explicit "Sign out and switch account"
 * button instead.
 */
const searchSchema = z.object({
  reason: z.enum(["membership", "organization", "permission"]).optional(),
});

const ACCESS_DENIED_DESCRIPTION =
  "This workspace or action isn't available to your account. Contact your administrator or sign in with a different account.";

export const Route = createFileRoute("/access-denied")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Access denied — TaaSFlow" },
      // Utility page: kept out of search, but the share/preview tags are still
      // filled in so a pasted link never falls back to the homepage metadata.
      { name: "robots", content: "noindex,nofollow" },
      { name: "description", content: ACCESS_DENIED_DESCRIPTION },
      { property: "og:title", content: "Access denied — TaaSFlow" },
      { property: "og:description", content: ACCESS_DENIED_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessDeniedPage,
});

const COPY: Record<string, { title: string; body: string }> = {
  membership: {
    title: "Access denied",
    body: "Your account has no active workspace membership. Contact your administrator, or sign in with a different account.",
  },
  organization: {
    title: "You don't have access to this workspace",
    body: "This organization isn't associated with your account. If you believe this is a mistake, ask your organization owner to invite you.",
  },
  permission: {
    title: "You don't have permission for this",
    body: "Your seat doesn't include access to this area. Your organization owner can request a permission change.",
  },
};

function AccessDeniedPage() {
  const navigate = useNavigate();
  // Unknown/missing reason falls back to the non-destructive copy.
  const { reason = "permission" } = Route.useSearch();
  const copy = COPY[reason] ?? COPY.permission;
  const signOut = reason === "membership";

  async function signOutAndReturn() {
    await supabase.auth.signOut().catch(() => {});
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {signOut ? (
            <button
              type="button"
              onClick={() => void signOutAndReturn()}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Sign out and use a different account
            </button>
          ) : (
            <>
              <Link
                to="/client"
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Go to my workspace
              </Link>
              <Link
                to="/"
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Home
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
