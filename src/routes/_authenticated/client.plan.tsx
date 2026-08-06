import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Plan and billing now lives inside the single Account area.
 * Old links keep working.
 */
export const Route = createFileRoute("/_authenticated/client/plan")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/client/account",
      search: { ...(search as Record<string, unknown>), tab: "plan" } as never,
      statusCode: 301,
    });
  },
});
