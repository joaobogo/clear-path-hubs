import { createFileRoute, redirect } from "@tanstack/react-router";

/** Typo-shaped URL for the new client form; keep it working. */
export const Route = createFileRoute("/_authenticated/admin/clients_new")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/clients/new", statusCode: 301 });
  },
});
