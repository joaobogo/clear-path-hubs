import { createFileRoute, redirect } from "@tanstack/react-router";

/** The guessable URL for the Quality section. Send it to scoring review. */
export const Route = createFileRoute("/_authenticated/admin/quality")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/scoring/review", statusCode: 301 });
  },
});
