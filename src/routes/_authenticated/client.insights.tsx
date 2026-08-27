import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The section is called "Insights" and lives at /client/executive.
 *
 * Anyone who bookmarks it, types it, or is sent it by a colleague reaches for
 * the name they can see. A pre-launch audit did exactly that and got the
 * workspace's "no longer available in your workspace" card, which reads as data
 * having been deleted rather than a URL that never existed.
 *
 * The route name stays where it is — this only makes the label work as an
 * address too.
 */
export const Route = createFileRoute("/_authenticated/client/insights")({
  beforeLoad: () => {
    throw redirect({ to: "/client/executive" });
  },
});
