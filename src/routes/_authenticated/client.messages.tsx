import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Messages folded into the single conversations surface.
 * Kept as a redirect so older notification links keep working.
 */
export const Route = createFileRoute("/_authenticated/client/messages")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/client/conversations",
      search: (prev: any) => ({ ...prev, view: "history" }),
      statusCode: 301,
    });
  },
});
