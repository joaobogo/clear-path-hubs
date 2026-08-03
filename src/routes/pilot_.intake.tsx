import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy pilot intake URL — the express onboarding flow is now the only path in. */
export const Route = createFileRoute("/pilot_/intake")({
  beforeLoad: () => {
    throw redirect({ to: "/intake", statusCode: 301 });
  },
});
