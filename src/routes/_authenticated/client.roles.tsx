import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy/guessable path. Roles live at /client/positions.
 */
export const Route = createFileRoute("/_authenticated/client/roles")({
  beforeLoad: () => {
    throw redirect({
      to: "/client/positions",
      search: (prev: any) => ({ ...prev }),
      statusCode: 301,
    });
  },
});
