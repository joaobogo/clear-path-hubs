import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  listClients,
  archiveOrganization,
  restoreOrganization,
} from "@/lib/admin.functions";
import { useIncludeTestRecords } from "@/lib/admin-scope";
import { Input } from "@/components/ui/input";
import { SavedViewsBar } from "@/components/workspace/saved-views-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const SORTS = [
  "activity_desc",
  "updated_desc",
  "updated_asc",
  "name_asc",
  "name_desc",
  "status_asc",
  "candidates_desc",
  "positions_desc",
  "action_desc",
] as const;
type Sort = (typeof SORTS)[number];
const STATUSES = ["prospect", "active", "paused", "closed"] as const;
type Status = (typeof STATUSES)[number];

const ORG_TYPES = [
  { value: "client_demo", label: "Clients + Demos" },
  { value: "all", label: "All types" },
  { value: "client", label: "Clients only" },
  { value: "demo", label: "Demos only" },
  { value: "qa", label: "QA only" },
  { value: "internal", label: "Internal only" },
] as const;
type OrgType = (typeof ORG_TYPES)[number]["value"];

const STATUS_LABEL: Record<Status, string> = {
  prospect: "Prospect",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
};

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
  industry: fallback(z.string(), "").default(""),
  org_type: fallback(z.string(), "client_demo").default("client_demo"),
  sort: fallback(z.string(), "activity_desc").default("activity_desc"),
  archived: fallback(z.enum(["0", "1"]), "0").default("0"),
  page: fallback(z.number().int(), 1).default(1),
  page_size: fallback(z.number().int(), 25).default(25),
});

function isSort(value: string): value is Sort {
  return SORTS.includes(value as Sort);
}

function isOrgType(value: string): value is OrgType {
  return ORG_TYPES.some((t) => t.value === value);
}

function isStatus(value: string): value is Status {
  return STATUSES.includes(value as Status);
}

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  validateSearch: zodValidator(searchSchema),
  pendingComponent: () => (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-12 w-full animate-pulse rounded bg-muted" />
      <div className="h-[400px] w-full animate-pulse rounded-lg bg-muted" />
    </div>
  ),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.clients.index.tsx"),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: ClientsPage,
});

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.round(d / 30);
  return `${mo} mo`;
}


type ClientRow = {
  id: string;
  name: string;
  status: string;
  domain: string | null;
  industry: string | null;
  archived_at: string | null;
  onboarding_status: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  is_demo: boolean;
  is_qa: boolean;
  is_internal: boolean;
  is_test_record: boolean;
  positions_total: number;
  positions_active: number;
  candidates_delivered: number;
  actions_required: number;
  last_activity_at: string | null;
};

function orgType(row: ClientRow): string {
  if (row.is_internal) return "Internal";
  if (row.is_qa) return "QA";
  if (row.is_demo) return "Demo";
  return "Client";
}

function ClientsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const includeTest = useIncludeTestRecords();
  const [q, setQ] = useState(search.q);
  useEffect(() => setQ(search.q), [search.q]);

  const query = useQuery({
    queryKey: ["admin-clients", includeTest, search.sort],
    queryFn: () =>
      listClients({
        data: {
          include_test: includeTest,
          sort: isSort(search.sort) ? search.sort : "activity_desc",
        },
      }),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });

  const data = query.data;

  const filtered = useMemo(() => {
    const raw = (data?.items ?? []) as ClientRow[];
    let rows = raw;

    const term = search.q.trim().toLowerCase();
    if (term) {
      rows = rows.filter((r) =>
        r.name.toLowerCase().includes(term) ||
        (r.domain ?? "").toLowerCase().includes(term) ||
        (r.industry ?? "").toLowerCase().includes(term),
      );
    }

    if (search.status && isStatus(search.status)) {
      rows = rows.filter((r) => r.status === search.status);
    }

    if (search.industry) {
      rows = rows.filter((r) => r.industry === search.industry);
    }

    const orgTypeValue = isOrgType(search.org_type) ? search.org_type : "client_demo";
    if (orgTypeValue !== "all") {
      rows = rows.filter((r) => {
        if (orgTypeValue === "client_demo") return !r.is_qa && !r.is_internal;
        if (orgTypeValue === "client") return !r.is_demo && !r.is_qa && !r.is_internal;
        if (orgTypeValue === "demo") return r.is_demo;
        if (orgTypeValue === "qa") return r.is_qa;
        if (orgTypeValue === "internal") return r.is_internal;
        return true;
      });
    }

    // P-020: Ensure that even if archived are hidden by default, 
    // a specific search for a name includes them if they match.
    if (search.archived !== "1" && !term) {
      rows = rows.filter((r) => !r.archived_at);
    }

    return rows;
  }, [data, search]);


  const total = filtered.length;
  const activeCount = filtered.filter(r => !r.archived_at).length;
  const archivedCount = filtered.filter(r => !!r.archived_at).length;
  const page = Math.max(1, search.page);
  const pageSize = Math.max(10, Math.min(100, search.page_size));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  const showingFrom = total === 0 ? 0 : start + 1;
  const showingTo = Math.min(total, page * pageSize);
  const industries = data?.industries ?? [];

  const [archiveTarget, setArchiveTarget] = useState<ClientRow | null>(null);


  return (
    <div className="space-y-6">
      
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCount} active
            {archivedCount > 0 ? (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      search: {
                        ...search,
                        archived: search.archived === "1" ? "0" : "1",
                        page: 1,
                      },
                    })
                  }
                  className="underline hover:text-foreground"
                >
                  {archivedCount} archived
                </button>
              </>
            ) : null}
            {total > 0 && search.archived === "0" ? (
              <span>
                {" · "}showing {showingFrom}–{showingTo}
              </span>
            ) : null}
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

      {/* Filters live in the URL, so any view here can be named, saved and shared. */}
      <SavedViewsBar
        surface="admin_clients"
        canShare
        currentFilters={{
          q: search.q ?? "",
          status: search.status ?? "",
          industry: search.industry ?? "",
          org_type: search.org_type ?? "client_demo",
          sort: search.sort ?? "activity_desc",
          archived: search.archived ?? "0",
        }}
        onApply={(f) =>
          navigate({
            search: {
              ...search,
              q: f.q ?? "",
              status: f.status ?? "",
              industry: f.industry ?? "",
              org_type: f.org_type ?? "client_demo",
              sort: f.sort || "activity_desc",
              archived: f.archived === "1" ? "1" : "0",
              page: 1,
            },
          })
        }
      />

      <form
        noValidate
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
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={search.org_type || "client_demo"}
          onValueChange={(v) =>
            navigate({ search: { ...search, org_type: v, page: 1 } })
          }
        >
          <SelectTrigger className="w-36" data-qa-action="clients-filter-type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {ORG_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={search.industry || "all"}
          onValueChange={(v) =>
            navigate({ search: { ...search, industry: v === "all" ? "" : v, page: 1 } })
          }
        >
          <SelectTrigger className="w-44" data-qa-action="clients-filter-industry">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {industries.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
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
            <SelectItem value="action_desc">Action required (most)</SelectItem>
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
        <div className="hidden md:block">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="whitespace-nowrap">
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">Primary contact</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium tabular-nums text-right">Active positions</th>
                <th className="px-3 py-2.5 font-medium tabular-nums text-right">Delivered</th>
                <th className="px-3 py-2.5 font-medium text-right">Last activity</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {rows.map((r) => (
                <ClientRowView key={r.id} row={r} onArchive={() => setArchiveTarget(r)} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <p>No clients match these filters.</p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() =>
                          navigate({
                            search: {
                              ...search,
                              q: "",
                              status: "",
                              industry: "",
                              org_type: "client_demo",
                              archived: "0",
                              page: 1,
                            },
                          })
                        }
                      >
                        Clear filters
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards */}
        <ul className="divide-y md:hidden">
          {rows.map((r) => (
            <li key={r.id} className="p-3">
              <ClientCard row={r} onArchive={() => setArchiveTarget(r)} />
            </li>
          ))}
          {rows.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">
              No clients match these filters.
            </li>
          )}
        </ul>

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <div>
              Page {page} of {pageCount} · {total} total
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5">
                Rows:
                <Select
                  value={String(pageSize)}
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
                disabled={page <= 1}
                onClick={() =>
                  navigate({ search: { ...search, page: Math.max(1, page - 1) } })
                }
              >
                <ChevronLeft className="h-3 w-3" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1"
                disabled={page >= pageCount}
                onClick={() =>
                  navigate({ search: { ...search, page: Math.min(pageCount, page + 1) } })
                }
              >
                Next <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ArchiveDialog target={archiveTarget} onClose={() => setArchiveTarget(null)} />
    </div>
  );
}

function ClientRowView({ row, onArchive }: { row: ClientRow; onArchive: () => void }) {
  const r = row;
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2.5">
        <a
          href={`/admin/clients/${r.id}`}
          className="font-medium text-foreground hover:text-primary hover:underline"
          data-qa-action={`open-client-${r.id}`}
        >
          {r.name}
        </a>
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
        {r.primary_contact_name || r.primary_contact_email ? (
          <>
            <div className="text-foreground">
              {r.primary_contact_name
                ? r.primary_contact_name
                    .split(" ")
                    .map(
                      (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
                    )
                    .join(" ")
                : "—"}
            </div>
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
      <td className="px-3 py-2.5">
        <Badge variant="outline" className="whitespace-nowrap">
          {STATUS_LABEL[r.status as Status] ?? r.status}
        </Badge>
        {(r.is_qa || r.is_internal || r.is_demo || r.is_test_record) && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {r.is_test_record && !r.is_qa && !r.is_internal && !r.is_demo ? "Test" : orgType(r)}
          </div>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
        <span className="text-foreground">{r.positions_active}</span>
        <span className="text-muted-foreground"> / {r.positions_total}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{r.candidates_delivered}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-muted-foreground">{relTime(r.last_activity_at)}</td>
      <td className="px-3 py-2.5 text-right">
        <div className="inline-flex items-center gap-1">
          <a
            href={`/admin/clients/${r.id}`}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15"
            data-qa-action={`open-btn-${r.id}`}
          >
            Open
          </a>

          <RowOverflowMenu row={r} onArchive={onArchive} />
        </div>
      </td>
    </tr>
  );
}

function ClientCard({ row, onArchive }: { row: ClientRow; onArchive: () => void }) {
  const r = row;
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={`/admin/clients/${r.id}`}
            className="block truncate text-base font-medium hover:text-primary hover:underline"
          >
            {r.name}
          </a>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{r.domain ?? "—"}</span>
            {r.industry && <span>· {r.industry}</span>}
            <Badge variant="outline">{STATUS_LABEL[r.status as Status] ?? r.status}</Badge>
            {r.is_test_record && <Badge variant="outline" className="text-[10px] bg-muted/50">test</Badge>}
            {r.archived_at && <Badge variant="secondary" className="text-[10px]">archived</Badge>}
          </div>
        </div>
        <RowOverflowMenu row={r} onArchive={onArchive} />
      </div>
      <div className="grid grid-cols-4 gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-center text-xs">
        <div>
          <div className="tabular-nums font-medium">{r.positions_active}</div>
          <div className="text-muted-foreground">Active</div>
        </div>
        <div>
          <div className="tabular-nums font-medium">{r.candidates_delivered}</div>
          <div className="text-muted-foreground">Delivered</div>
        </div>
        <div>
          <div className="tabular-nums font-medium">{r.actions_required}</div>
          <div className="text-muted-foreground">Action</div>
        </div>
        <div>
          <div className="tabular-nums font-medium">{relTime(r.last_activity_at)}</div>
          <div className="text-muted-foreground">Activity</div>
        </div>
      </div>
      <a
        href={`/admin/clients/${r.id}`}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        Open client
      </a>
    </div>
  );
}

function RowOverflowMenu({ row, onArchive }: { row: ClientRow; onArchive: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const restore = useMutation({
    mutationFn: (id: string) => restoreOrganization({ data: { id } }),
    onSuccess: () => {
      toast.success(`${row.name} restored`);
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      router.invalidate();
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={`More actions for ${row.name}`}
          data-qa-action={`menu-${row.id}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{row.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            to="/client"
            search={{ org: row.id, preview: "client_admin" }}
            data-qa-action={`view-workspace-${row.id}`}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View Client Workspace
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/clients/$id" params={{ id: row.id }} search={{ tab: "overview" }}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/team" search={{ org: row.id }}>
            <Users className="mr-2 h-4 w-4" />
            Manage Team
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {row.archived_at ? (
          <DropdownMenuItem
            onClick={() => restore.mutate(row.id)}
            disabled={restore.isPending}
            data-qa-action={`restore-${row.id}`}
          >
            <ArchiveRestore className="mr-2 h-4 w-4" />
            Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={onArchive}
            className="text-destructive focus:text-destructive"
            data-qa-action={`archive-${row.id}`}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ArchiveDialog({ target, onClose }: { target: ClientRow | null; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  useEffect(() => setConfirm(""), [target?.id]);
  const archive = useMutation({
    mutationFn: (input: { id: string; confirm_name: string }) =>
      archiveOrganization({ data: input }),
    onSuccess: () => {
      toast.success(`${target?.name ?? "Client"} archived`);
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      router.invalidate();
      onClose();
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });
  const open = !!target;
  const matches =
    !!target && confirm.trim().toLowerCase() === target.name.trim().toLowerCase();
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Archive {target?.name}?</DialogTitle>
          <DialogDescription>
            The organization becomes read-only for its team. Active positions are closed. You can
            restore it later from the archived filter.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Type <span className="font-mono text-foreground">{target?.name}</span> to confirm
          </label>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoFocus
            data-qa-action="archive-confirm-input"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={archive.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || archive.isPending}
            onClick={() =>
              target && archive.mutate({ id: target.id, confirm_name: confirm.trim() })
            }
            data-qa-action="archive-confirm-submit"
          >
            {archive.isPending ? "Archiving…" : "Archive client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
