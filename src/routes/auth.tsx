import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy /auth path redirects to the canonical /login route.
export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
