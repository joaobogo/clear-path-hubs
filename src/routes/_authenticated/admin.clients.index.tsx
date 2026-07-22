import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { listClients } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const searchSchema = z.object({ q: z.string().optional().default("") });

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-clients", deps.q],
      queryFn: () => listClients({ data: { q: deps.q } }),
    }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Clients unavailable: {error.message}</div>
  ),
  component: ClientsPage,
});

function ClientsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q);
  const { data: rows } = useSuspenseQuery({
    queryKey: ["admin-clients", search.q],
    queryFn: () => listClients({ data: { q: search.q } }),
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clients & Positions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search clients, open their organization to see users and positions.
          </p>
        </div>
        <Link
          to="/admin/clients_new"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + New client
        </Link>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: { q } });
        }}
        className="mb-4 flex gap-2"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search organizations by name"
          className="max-w-md"
        />
        <button className="rounded border px-3 text-sm hover:bg-muted">Search</button>
      </form>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Organization</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Domain</th>
              <th className="px-3 py-2 font-medium tabular-nums">Positions</th>
              <th className="px-3 py-2 font-medium tabular-nums">Active</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(rows as any[]).map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link
                    to="/admin/clients/$id"
                    params={{ id: r.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{r.status}</Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.domain ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.positions_total}</td>
                <td className="px-3 py-2 tabular-nums">{r.positions_active}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.updated_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to="/client"
                    search={{ org: r.id, preview: "client_admin" }}
                    className="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted"
                    title="View this client's dashboard as an administrator (read-only)"
                  >
                    View Dashboard
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-16 text-center text-muted-foreground">
                  No clients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
