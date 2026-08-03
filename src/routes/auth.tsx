import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy /auth path 308 → /login.
 * Permanent redirect (was previously the default 307/temporary).
 * The path has never had first-class content and will not be reused.
 */
export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/login", statusCode: 301 });
  },
});
