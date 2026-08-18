/**
 * /admin/my-day — retired.
 *
 * "My day" was a filter wearing a page's clothes: it showed the owned slice of
 * the shared admin queues. That slice now lives on the Work queue itself as the
 * "Mine" scope, so this route only preserves the old URL.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/my-day")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", search: { scope: "mine" } });
  },
});
