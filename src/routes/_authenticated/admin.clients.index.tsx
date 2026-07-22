import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { listClients } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORTS = ["updated_desc", "updated_asc", "name_asc", "name_desc", "status_asc"] as const;
const STATUSES = ["prospect", "active", "paused", "closed"] as const;

const searchSchema = z.object({
  q: z.string().optional().default(""),
  status: z.enum(STATUSES).optional(),
  sort: z.enum(SORTS).optional().default("updated_desc"),
  archived: z.enum(["0", "1"]).optional().default("0"),
});

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    q: search.q ?? "",
    status: search.status,
    sort: search.sort ?? "updated_desc",
    archived: search.archived ?? "0",
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-clients", deps],
      queryFn: () =>
        listClients({
          data: {
            q: deps.q,
            status: deps.status,
            sort: deps.sort,
            include_archived: deps.archived === "1",
          },
        }),
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
  const deps = {
    q: search.q,
    status: search.status,
    sort: search.sort,
    archived: search.archived,
  };
  const { data: rows } = useSuspenseQuery({
    queryKey: ["admin-clients", deps],
    queryFn: () =>
      listClients({
        data: {
          q: search.q,
          status: search.status,
          sort: search.sort,
          include_archived: search.archived === "1",
        },
      }),
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a client to see its full workspace: profile, team, positions,
            candidates, activity, and archive.
          </p>
        </div>
        <Link
          to="/admin/clients_new"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-qa-action="new-client"
        >
          + New client
        </Link>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: { ...search, q } });
        }}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search organizations by name"
          className="max-w-sm"
          data-qa-action="clients-search-input"
        />
        <button
          type="submit"
          className="rounded border px-3 py-2 text-sm hover:bg-muted"
          data-qa-action="clients-search-submit"
        >
          Search
        </button>

        <Select
          value={search.status ?? "all"}
          onValueChange={(v) =>
            navigate({
              search: {
                ...search,
                status: v === "all" ? undefined : (v as (typeof STATUSES)[number]),
              },
            })
          }
        >
          <SelectTrigger className="w-40" data-qa-action="clients-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={search.sort}
          onValueChange={(v) =>
            navigate({ search: { ...search, sort: v as (typeof SORTS)[number] } })
          }
        >
          <SelectTrigger className="w-52" data-qa-action="clients-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Last updated (newest)</SelectItem>
            <SelectItem value="updated_asc">Last updated (oldest)</SelectItem>
            <SelectItem value="name_asc">Name (A → Z)</SelectItem>
            <SelectItem value="name_desc">Name (Z → A)</SelectItem>
            <SelectItem value="status_asc">Status</SelectItem>
          </SelectContent>
        </Select>

        <label className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={search.archived === "1"}
            onChange={(e) =>
              navigate({
                search: { ...search, archived: e.target.checked ? "1" : "0" },
              })
            }
            data-qa-action="clients-include-archived"
          />
          Include archived
        </label>
      </form>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Organization</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Onboarding</th>
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
                    data-qa-action={`open-client-${r.id}`}
                  >
                    {r.name}
                  </Link>
                  {r.archived_at && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      archived
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="capitalize">{r.status}</Badge>
                </td>
                <td className="px-3 py-2 capitalize text-xs text-muted-foreground">
                  {(r.onboarding_status ?? "not_started").replace("_", " ")}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.domain ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.positions_total}</td>
                <td className="px-3 py-2 tabular-nums">{r.positions_active}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.updated_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Link
                      to="/admin/clients/$id"
                      params={{ id: r.id }}
                      className="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted"
                      data-qa-action={`open-btn-${r.id}`}
                    >
                      Open
                    </Link>
                    <Link
                      to="/client"
                      search={{ org: r.id, preview: "client_admin" }}
                      className="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted"
                      title="View this client's dashboard as an administrator (read-only)"
                    >
                      View Dashboard
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-16 text-center text-muted-foreground">
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
