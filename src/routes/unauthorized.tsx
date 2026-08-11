import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";

const UNAUTHORIZED_TITLE = "Unauthorized — TaaSFlow";
const UNAUTHORIZED_DESCRIPTION =
  "You need to sign in to access this page. Return to the sign-in screen or head back home.";

export const Route = createFileRoute("/unauthorized")({
  head: () => ({
    meta: [
      { title: UNAUTHORIZED_TITLE },
      // Utility page: noindex, but share tags are still explicit so the
      // homepage metadata never stands in for it.
      { name: "robots", content: "noindex,nofollow" },
      { name: "description", content: UNAUTHORIZED_DESCRIPTION },
      { property: "og:title", content: UNAUTHORIZED_TITLE },
      { property: "og:description", content: UNAUTHORIZED_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnauthorizedPage,
});

function UnauthorizedPage() {
  return (
    <SiteShell>
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Error 401
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Sign in required
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          This page is only available to signed-in TaaSFlow users. Sign in to
          continue, or return home.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/login"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Sign in
          </Link>
          <Link
            to="/"
            className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Go home
          </Link>
          <Link
            to="/contact"
            className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Contact us
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
