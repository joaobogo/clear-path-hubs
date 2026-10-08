import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Interview requests and scheduling happen directly between the people involved.
 * Old bookmarks open the live candidate board, where recruitment progress is
 * tracked without creating bookings.
 */
export const Route = createFileRoute("/_authenticated/client/interviews")({
  beforeLoad: ({ search }) => {
    const org = (search as Record<string, unknown>).org;
    throw redirect({
      to: "/client/candidates",
      search: { view: "board", ...(typeof org === "string" ? { org } : {}) } as never,
      statusCode: 302,
    });
  },
});
