import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /admin/platform → /admin/payments
 *
 * The Platform section of the admin nav routes to /admin/payments, but the
 * bare /admin/platform URL had no route of its own, so it fell through to the
 * catch-all and rendered "We couldn't find that record — It may have been
 * archived, merged, or deleted" (audit 15 Sep, GEN-005). A section URL someone
 * typed, bookmarked or was linked to should land on that section, not on an
 * error that says their data is gone.
 *
 * beforeLoad, so the redirect happens before anything renders.
 */
export const Route = createFileRoute("/admin/platform")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/payments" });
  },
});
