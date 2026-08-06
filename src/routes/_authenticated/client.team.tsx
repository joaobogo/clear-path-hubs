import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Team management now lives inside the single Account area.
 * Old links keep working.
 */
export const Route = createFileRoute("/_authenticated/client/team")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/client/account",
      search: { ...(search as Record<string, unknown>), tab: "team" } as never,
      statusCode: 301,
    });
  },
});
