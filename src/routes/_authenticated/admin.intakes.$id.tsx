import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/intakes/$id")({
  component: () => (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Admin — Intake Detail</h1>
      <p className="mt-2 text-muted-foreground">Rewiring against the canonical schema.</p>
    </main>
  ),
});
