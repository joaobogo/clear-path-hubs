import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getClient } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/clients/$id")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["admin-client", params.id],
      queryFn: () => getClient({ data: { id: params.id } }),
    });
    if (!d) throw notFound();
    return d;
  },
  notFoundComponent: () => (
    <div className="p-8">Organization not found.</div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">{error.message}</div>
  ),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery({
    queryKey: ["admin-client", id],
    queryFn: () => getClient({ data: { id } }),
  });
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = data.organization as any;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div>
        <Link to="/admin/clients" className="text-sm text-muted-foreground hover:underline">
          ← Clients
        </Link>
        <div className="mt-2 flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold">{org.name}</h1>
          <Badge variant="outline">{org.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {org.domain ?? "—"} · {org.industry ?? "—"} · {org.headquarters ?? "—"}
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">
          Positions ({data.positions.length})
        </h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Visibility</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/positions/$id"
                      params={{ id: p.id }}
                      className="text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge>{p.status}</Badge>
                  </td>
                  <td className="px-3 py-2 capitalize">{p.visibility}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.location ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {data.positions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No positions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">
          Client users ({data.members.length})
        </h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2">{m.profiles?.full_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {m.profiles?.email ?? "—"}
                  </td>
                  <td className="px-3 py-2 capitalize">{m.role}</td>
                  <td className="px-3 py-2 capitalize">{m.status}</td>
                </tr>
              ))}
              {data.members.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
