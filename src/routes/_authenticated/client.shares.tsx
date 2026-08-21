import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/client/shares")({
  loader: () => {
    throw notFound();
  },
});
