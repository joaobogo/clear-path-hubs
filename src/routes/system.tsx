import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /system was merged into /how-it-works#scoring. Permanent redirect; the table in
 * src/config/legacy-redirects.ts is the source of truth and is also applied
 * as an HTTP 301 in src/start.ts.
 */
export const Route = createFileRoute("/system")({
  beforeLoad: () => {
    throw redirect({ to: "/how-it-works", hash: "scoring", statusCode: 301 });
  },
});
