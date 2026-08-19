import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/client/shares")({
  loader: () => {
    throw redirect({ to: "/client" });
  },
});
