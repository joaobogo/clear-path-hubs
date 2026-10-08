import { createFileRoute, redirect } from "@tanstack/react-router";

/** Staff track recruitment progress on candidate records, not in a booking desk. */
export const Route = createFileRoute("/_authenticated/admin/interviews")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/candidates", statusCode: 302 });
  },
});
