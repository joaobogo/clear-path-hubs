import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/intakes")({
  component: () => (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Admin — Intakes</h1>
      <p className="mt-2 text-muted-foreground">
        Rewiring to the canonical schema. This queue will return in the next phase.
      </p>
    </main>
  ),
});
