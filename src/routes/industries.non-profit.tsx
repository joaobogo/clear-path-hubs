import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy path kept alive for inbound links only. Nothing in the app links
// here; the canonical content path is /industries/nonprofit.
export const Route = createFileRoute("/industries/non-profit")({
  beforeLoad: () => {
    throw redirect({
      to: "/industries/$slug",
      params: { slug: "nonprofit" },
      statusCode: 301,
    });
  },
});
