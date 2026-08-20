import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * There is no separate admin interviews desk: interview requests and the
 * decisions we are waiting on live on the decision backlog.
 */
export const Route = createFileRoute("/_authenticated/admin/interviews")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/decision-backlog", statusCode: 301 });
  },
});
