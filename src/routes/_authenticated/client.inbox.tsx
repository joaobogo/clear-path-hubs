import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Inbox folded into the single conversations surface. Notifications live in the
 * bell menu, notification preferences live in Settings.
 */
export const Route = createFileRoute("/_authenticated/client/inbox")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/client/conversations",
      search: { ...(search as Record<string, unknown>), box: "unread" },
      statusCode: 301,
    });
  },
});
