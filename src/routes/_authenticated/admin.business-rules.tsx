import { createFileRoute, redirect } from "@tanstack/react-router";

/** Business rules now live inside Settings. Keep old bookmarks working. */
export const Route = createFileRoute("/_authenticated/admin/business-rules")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/settings", statusCode: 301 });
  },
});
