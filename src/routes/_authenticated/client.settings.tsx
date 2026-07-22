import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client.functions";

export const Route = createFileRoute("/_authenticated/client/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const ctxFn = useServerFn(getClientContext);
  const { data: ctx } = useQuery({
    queryKey: ["client-context", null],
    queryFn: () => ctxFn({ data: {} }),
  });
  const active = ctx?.active;
  const canManage =
    active?.role === "client_admin" ||
    active?.role === "platform_admin" ||
    active?.role === "operations";

  if (!canManage) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only admins can change workspace settings.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Workspace configuration for {active?.name}.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-medium mb-2">Workspace</h2>
        <dl className="text-sm space-y-1">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{active?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Your role</dt>
            <dd className="capitalize">{active?.role.replace(/_/g, " ")}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-medium mb-2">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Coming soon — email preferences for new candidates, interview updates, and messages.
        </p>
      </section>
    </main>
  );
}
