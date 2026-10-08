import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Employment offers are negotiated and issued off-platform. Existing bookmarks
 * go to stage tracking, not an offer creation or management desk.
 */
export const Route = createFileRoute("/_authenticated/client/offers")({
  beforeLoad: ({ search }) => {
    const org = (search as Record<string, unknown>).org;
    throw redirect({
      to: "/client/candidates",
      search: { view: "board", ...(typeof org === "string" ? { org } : {}) } as never,
      statusCode: 302,
    });
  },
});
