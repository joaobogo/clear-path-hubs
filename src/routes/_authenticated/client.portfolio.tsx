import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/client/portfolio")({
  loader: () => {
    throw notFound();
  },
});
