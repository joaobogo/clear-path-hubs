import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext, getClientTeam } from "@/lib/client.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/client/team")({
  head: () => ({
    meta: [
      { title: "Team · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Failed to load: {error.message}</div>
  ),
  component: TeamPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function TeamPage() {
  const ctxFn = useServerFn(getClientContext);
  const teamFn = useServerFn(getClientTeam);
  const { data: ctx } = useQuery({
    queryKey: ["client-context", null],
    queryFn: () => ctxFn({ data: {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const canManage =
    ctx?.active?.role === "client_admin" ||
    ctx?.active?.role === "platform_admin" ||
    ctx?.active?.role === "operations";

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["client-team", orgId],
    queryFn: () => teamFn({ data: { orgId: orgId! } }),
    enabled: !!orgId && !!canManage,
  });

  if (!canManage) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t have access to team management. Ask an admin.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">Members of your workspace.</p>
      </header>
      {isLoading && <div className="text-muted-foreground text-sm">Loading…</div>}
      {error && (
        <div className="text-destructive text-sm">Failed to load: {(error as Error).message}</div>
      )}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(rows as AnyRow[]).map((r) => (
              <tr key={r.user_id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.profiles?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.profiles?.email}</div>
                </td>
                <td className="px-3 py-2 capitalize">{String(r.role).replace(/_/g, " ")}</td>
                <td className="px-3 py-2">
                  <Badge variant={r.status === "active" ? "default" : "secondary"}>
                    {r.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !isLoading && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
