import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /platform was merged into /how-it-works#workspace. Permanent redirect; the table in
 * src/config/legacy-redirects.ts is the source of truth and is also applied
 * as an HTTP 301 in src/start.ts.
 */
export const Route = createFileRoute("/platform")({
  beforeLoad: () => {
    throw redirect({ to: "/how-it-works", hash: "workspace", statusCode: 301 });
  },
});
