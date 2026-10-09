import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /employer-onboarding was merged into /how-it-works#steps. Permanent redirect; the table in
 * src/config/legacy-redirects.ts is the source of truth and is also applied
 * as an HTTP 301 in src/start.ts.
 */
export const Route = createFileRoute("/employer-onboarding")({
  beforeLoad: () => {
    throw redirect({ to: "/how-it-works", hash: "steps", statusCode: 301 });
  },
});
