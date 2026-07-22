import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings · TaaSFlow admin" }] }),
  component: () => (
    <main className="mx-auto max-w-3xl px-6 py-8 space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-muted-foreground">
        User roles, workspace preferences, and integration keys live here. Kept separate
        from operational sections to reduce distraction from daily queues.
      </p>
      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Access</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage platform staff and operations users through role assignments in the
          Supabase-managed <code>user_roles</code> and <code>memberships</code> tables
          (self-serve UI is scoped for a later phase).
        </p>
      </section>
    </main>
  ),
});
