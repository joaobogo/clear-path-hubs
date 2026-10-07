import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /trust was merged into /security. Permanent redirect; the table in
 * src/config/legacy-redirects.ts is the source of truth and is also applied
 * as an HTTP 301 in src/start.ts.
 */
export const Route = createFileRoute("/trust")({
  beforeLoad: () => {
    throw redirect({ to: "/security", statusCode: 301 });
  },
});
