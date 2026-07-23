import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { listClients } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";

const SORTS = [
  "activity_desc",
  "updated_desc",
  "updated_asc",
  "name_asc",
  "name_desc",
  "status_asc",
  "candidates_desc",
  "positions_desc",
] as const;
const STATUSES = ["prospect", "active", "paused", "closed"] as const;

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "activity_desc").default("activity_desc"),
  archived: fallback(z.enum(["0", "1"]), "0").default("0"),
  page: fallback(z.number().int(), 1).default(1),
  page_size: fallback(z.number().int(), 25).default(25),
});

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-clients", deps],
      queryFn: () =>
        listClients({
          data: {
            q: deps.q,
            status: STATUSES.includes(deps.status as (typeof STATUSES)[number])
              ? (deps.status as (typeof STATUSES)[number])
              : undefined,
            sort: (SORTS.includes(deps.sort as (typeof SORTS)[number])
              ? deps.sort
              : "activity_desc") as (typeof SORTS)[number],
            include_archived: deps.archived === "1",
            page: Math.max(1, deps.page),
            page_size: Math.max(10, Math.min(100, deps.page_size)),
          },
        }),
    }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Clients unavailable: {error.message}</div>
  ),
  component: ClientsPage,
});

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  return `${mo}mo ago`;
}

function ClientsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q);
  useEffect(() => setQ(search.q), [search.q]);

  const { data } = useSuspenseQuery({
    queryKey: ["admin-clients", search],
    queryFn: () =>
      listClients({
        data: {
          q: search.q,
          status: STATUSES.includes(search.status as (typeof STATUSES)[number])
            ? (search.status as (typeof STATUSES)[number])
            : undefined,
          sort: (SORTS.includes(search.sort as (typeof SORTS)[number])
            ? search.sort
            : "activity_desc") as (typeof SORTS)[number],
          include_archived: search.archived === "1",
          page: Math.max(1, search.page),
          page_size: Math.max(10, Math.min(100, search.page_size)),
        },
      }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = data.items ?? [];
  const showingFrom = data.total === 0 ? 0 : (data.page - 1) * data.page_size + 1;
  const showingTo = Math.min(data.total, data.page * data.page_size);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.total} organization{data.total === 1 ? "" : "s"} · showing {showingFrom}–{showingTo}
          </p>
        </div>
        <Link
          to="/admin/clients_new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-qa-action="new-client"
        >
          + New client
        </Link>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: { ...search, q, page: 1 } });
        }}
        className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3"
      >
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search organizations by name"
            className="pl-8"
            data-qa-action="clients-search-input"
          />
        </div>

        <Select
          value={search.status || "all"}
          onValueChange={(v) =>
            navigate({ search: { ...search, status: v === "all" ? "" : v, page: 1 } })
          }
        >
          <SelectTrigger className="w-36" data-qa-action="clients-filter-status">
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
          onValueChange={(v) => navigate({ search: { ...search, sort: v, page: 1 } })}
        >
          <SelectTrigger className="w-52" data-qa-action="clients-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activity_desc">Last activity</SelectItem>
            <SelectItem value="updated_desc">Last updated (newest)</SelectItem>
            <SelectItem value="updated_asc">Last updated (oldest)</SelectItem>
            <SelectItem value="candidates_desc">Candidates delivered</SelectItem>
            <SelectItem value="positions_desc">Active positions</SelectItem>
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
                search: {
                  ...search,
                  archived: e.target.checked ? "1" : "0",
                  page: 1,
                },
              })
            }
            data-qa-action="clients-include-archived"
          />
          Include archived
        </label>

        <Button type="submit" variant="outline" size="sm" className="ml-auto">
          Apply
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Organization</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Primary contact</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">Active</th>
              <th className="px-3 py-2.5 font-medium tabular-nums">Delivered</th>
              <th className="px-3 py-2.5 font-medium">Last activity</th>
              <th className="px-3 py-2.5 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <Link
                    to="/admin/clients/$id"
                    params={{ id: r.id }}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                    data-qa-action={`open-client-${r.id}`}
                  >
                    {r.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{r.domain ?? "—"}</span>
                    {r.industry && <span>· {r.industry}</span>}
                    {r.archived_at && (
                      <Badge variant="secondary" className="text-[10px]">
                        archived
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="outline" className="capitalize">
                    {r.status}
                  </Badge>
                  {r.onboarding_status && r.onboarding_status !== "live" && (
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {String(r.onboarding_status).replace(/_/g, " ")}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {r.primary_contact_name || r.primary_contact_email ? (
                    <>
                      <div className="text-foreground">{r.primary_contact_name ?? "—"}</div>
                      {r.primary_contact_email && (
                        <a
                          href={`mailto:${r.primary_contact_email}`}
                          className="text-xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          {r.primary_contact_email}
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not set</span>
                  )}
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                  <span className="text-foreground">{r.positions_active}</span>
                  <span className="text-muted-foreground"> / {r.positions_total}</span>
                </td>
                <td className="px-3 py-2.5 tabular-nums">{r.candidates_delivered}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {relTime(r.last_activity_at)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Link
                    to="/admin/clients/$id"
                    params={{ id: r.id }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    data-qa-action={`open-btn-${r.id}`}
                  >
                    Open <ArrowRight className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-16 text-center text-muted-foreground">
                  No clients match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <div>
              Page {data.page} of {data.page_count} · {data.total} total
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5">
                Rows:
                <Select
                  value={String(search.page_size)}
                  onValueChange={(v) =>
                    navigate({ search: { ...search, page_size: Number(v), page: 1 } })
                  }
                >
                  <SelectTrigger className="h-7 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1"
                disabled={data.page <= 1}
                onClick={() =>
                  navigate({ search: { ...search, page: Math.max(1, data.page - 1) } })
                }
              >
                <ChevronLeft className="h-3 w-3" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1"
                disabled={data.page >= data.page_count}
                onClick={() =>
                  navigate({ search: { ...search, page: Math.min(data.page_count, data.page + 1) } })
                }
              >
                Next <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
