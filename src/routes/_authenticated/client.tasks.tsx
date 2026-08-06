import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * One name per concept: the tasks surface is now "Approvals". Kept as a
 * permanent redirect so older links and notifications keep working.
 */
export const Route = createFileRoute("/_authenticated/client/tasks")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/client/approvals",
      search: search as Record<string, unknown>,
      statusCode: 301,
    });
  },
});
