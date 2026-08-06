import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Workspace settings now lives inside the single Account area.
 * Old links keep working.
 */
export const Route = createFileRoute("/_authenticated/client/settings")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/client/account",
      search: { ...(search as Record<string, unknown>), tab: "workspace" } as never,
      statusCode: 301,
    });
  },
});
