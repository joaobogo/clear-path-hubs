import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /journey was merged into /about#story. Permanent redirect; the table in
 * src/config/legacy-redirects.ts is the source of truth and is also applied
 * as an HTTP 301 in src/start.ts.
 */
export const Route = createFileRoute("/journey")({
  beforeLoad: () => {
    throw redirect({ to: "/about", hash: "story", statusCode: 301 });
  },
});
