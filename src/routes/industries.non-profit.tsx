import { createFileRoute, redirect } from "@tanstack/react-router";

// Source route used "non-profit" slug; destination canonical is "nonprofit".
export const Route = createFileRoute("/industries/non-profit")({
  beforeLoad: () => {
    throw redirect({ to: "/industries/$slug", params: { slug: "nonprofit" } });
  },
});
