import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/client/intelligence")({
  loader: () => {
    throw notFound();
  },
});
