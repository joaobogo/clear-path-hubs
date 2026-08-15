import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy/guessable deep paths under /client/roles map onto /client/positions.
 */
export const Route = createFileRoute("/_authenticated/client/roles/$")({
  beforeLoad: ({ params }) => {
    const rest = (params as { _splat?: string })._splat ?? "";
    throw redirect({
      href: rest ? `/client/positions/${rest}` : "/client/positions",
      statusCode: 301,
    });
  },
});
