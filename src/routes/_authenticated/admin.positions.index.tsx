import { useIncludeTestRecords } from "@/lib/admin-scope";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  listPositions,
  listPositionFilters,
  createPositionForClient,
} from "@/lib/admin.functions";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { AlertCircle, ArrowUpRight, Building2, MapPin } from "lucide-react";
import { ErrorState } from "@/components/ds";
import { PositionsAttentionQueue } from "@/components/admin/positions-attention-queue";
import { SavedViewsBar } from "@/components/workspace/saved-views-bar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BulkConfirmDialog,
  type PreviewInput,
} from "@/components/admin/bulk-confirm-dialog";
import { PublishGatePanel } from "@/components/admin/publish-gate-panel";
import { OwnershipCoveragePanel } from "@/components/admin/ownership-coverage-panel";


const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
  client: fallback(z.string(), "").default(""),
  owner: fallback(z.string(), "").default(""),
  location: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "updated_desc").default("updated_desc"),
  page: fallback(z.number().int(), 1).default(1),
  tab: fallback(z.enum(["all", "attention"]), "all").default("all"),
});


export const Route = createFileRoute("/_authenticated/admin/positions/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Positions · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Search, filter and open positions across every client. Track delivered, shortlisted, interviews and action-required signals.",
      },
    ],
  }),
  component: PositionsPage,
});

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  needs_clarification: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  approved: "bg-info/15 text-info dark:text-info",
  active: "bg-success/15 text-success dark:text-success",
  paused: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

const PAGE_SIZE = 25;

type Row = {
  id: string;
  title: string;
  status: string;
  visibility: string;
  updated_at: string;
  location: string | null;
  organization_id: string;
  organizations?: { id: string; name: string } | null;
  counts: {
    delivered: number;
    shortlisted: number;
    interviews: number;
    action_required: number;
  };
};

function PositionsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // Admin-wide scope from the layout: the overview count and this list read the
  // same set of organisations.
  const includeTest = useIncludeTestRecords();

  const list = useServerFn(listPositions);
  const filtersFn = useServerFn(listPositionFilters);

  // Local, debounced search input.
  const [q, setQ] = useState(search.q);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkRequest, setBulkRequest] = useState<PreviewInput | null>(null);
  useEffect(() => setQ(search.q), [search.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if ((q ?? "") !== (search.q ?? "")) {
        navigate({
          search: (s: Record<string, unknown>) => ({ ...s, q: q || undefined, page: 1 }),
          replace: true,
        });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, search.q, navigate]);

  const filters = useQuery({
    queryKey: ["admin", "position-filters"],
    queryFn: () => filtersFn(),
    staleTime: 60_000,
  });

  const listQuery = useQuery({
    queryKey: [
      "admin",
      "positions",
      {
        q: search.q,
        status: search.status,
        client: search.client,
        owner: search.owner,
        location: search.location,
        sort: search.sort,
        page: search.page,
        show_test: includeTest,
      },
    ],
    queryFn: () =>
      list({
        data: {
          q: search.q || undefined,
          status: search.status || undefined,
          organization_id: search.client || undefined,
          owner: search.owner || undefined,
          location: search.location || undefined,
          sort: search.sort as never,
          page: search.page,
          page_size: PAGE_SIZE,
          include_test: includeTest || undefined,
        },
      }),
    placeholderData: (prev) => prev,
  });

  const payload = (listQuery.data ?? {
    rows: [] as Row[],
    total: 0,
    page: 1,
    page_size: PAGE_SIZE,
    include_test: false,
    hidden_test: 0,
  }) as {
    rows: Row[];
    total: number;
    page: number;
    page_size: number;
    include_test?: boolean;
    hidden_test?: number;
  };
  const rows = payload.rows;
  const total = payload.total;
  const hiddenTest = payload.hidden_test ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));


  const setSearch = (patch: Record<string, string | number | boolean | undefined>) =>
    navigate({
      search: (s: Record<string, unknown>) => ({ ...s, ...patch }),
      replace: true,
    });

  const activeFilters =
    (search.status ? 1 : 0) +
    (search.client ? 1 : 0) +
    (search.owner ? 1 : 0) +
    (search.location ? 1 : 0) +
    (search.q ? 1 : 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>
          <p className="text-sm text-muted-foreground">
            {listQuery.isError
              ? "Couldn't load positions"
              : listQuery.isLoading
              ? "Loading positions…"
              : `${total.toLocaleString()} position${total === 1 ? "" : "s"} across all clients`}
            {!listQuery.isLoading && !listQuery.isError && hiddenTest > 0 && (
              <>
                {" · "}
                <span>{hiddenTest.toLocaleString()} hidden as test/internal</span>
              </>
            )}

            {activeFilters > 0 && (
              <>
                {" · "}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() =>
                    navigate({
                      search: {
                        q: undefined,
                        status: undefined,
                        client: undefined,
                        owner: undefined,
                        location: undefined,
                        sort: undefined,
                        page: 1,
                      },
                      replace: true,
                    })
                  }
                >
                  clear filters
                </button>
              </>
            )}
          </p>
        </div>
        <NewRoleDialog clients={filters.data?.clients ?? []} />
      </header>

      {/* Tabs: the whole book vs today's stalling roles. */}
      <div className="flex flex-wrap items-center gap-2 border-b" role="tablist" aria-label="Position views">
        {([
          ["all", "All positions"],
          ["attention", "Needs attention"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={search.tab === id}
            onClick={() => setSearch({ tab: id === "all" ? undefined : id })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              search.tab === id
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}

      </div>

      {search.tab === "attention" ? (
        <>
          <OwnershipCoveragePanel includeTest={includeTest} />
          <PositionsAttentionQueue includeTest={includeTest} />
        </>
      ) : (
      <>
      <OwnershipCoveragePanel includeTest={includeTest} />
      <PublishGatePanel includeTest={includeTest} />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">

        <SavedViewsBar
          surface="admin_positions"
          canShare
          currentFilters={{
            q: search.q ?? "",
            status: search.status ?? "",
            client: search.client ?? "",
            owner: search.owner ?? "",
            location: search.location ?? "",
            sort: search.sort ?? "",
          }}
          onApply={(f: Record<string, string>) =>
            navigate({
              search: (s: Record<string, unknown>) => ({
                ...s,
                q: f["q"] || undefined,
                status: f["status"] || undefined,
                client: f["client"] || undefined,
                owner: f["owner"] || undefined,
                location: f["location"] || undefined,
                sort: f["sort"] || undefined,
                page: 1,
              }),
              replace: true,
            })
          }
        />


        <Input
          placeholder="Search title…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 w-full sm:w-64"
          aria-label="Search positions by title"
        />
        <Select
          value={search.client || "all"}
          onValueChange={(v) => setSearch({ client: v === "all" ? undefined : v, page: 1 })}
        >
          <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Filter by client">
            <SelectValue placeholder="Any client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any client</SelectItem>
            {(filters.data?.clients ?? []).map((c: { id: string; name: string }) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.status || "all"}
          onValueChange={(v) => setSearch({ status: v === "all" ? undefined : v, page: 1 })}
        >
          <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filter by status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="needs_clarification">Needs clarification</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={search.location || "all"}
          onValueChange={(v) => setSearch({ location: v === "all" ? undefined : v, page: 1 })}
        >
          <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Filter by location">
            <SelectValue placeholder="Any location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any location</SelectItem>
            {(filters.data?.locations ?? []).map((loc: string) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.sort || "updated_desc"}
          onValueChange={(v) => setSearch({ sort: v })}
        >
          <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Sort positions">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Recently updated</SelectItem>
            <SelectItem value="updated_asc">Oldest updated</SelectItem>
            <SelectItem value="title_asc">Title A–Z</SelectItem>
            <SelectItem value="title_desc">Title Z–A</SelectItem>
            <SelectItem value="delivered_desc">Most delivered</SelectItem>
            <SelectItem value="action_desc">Action required first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkRequest({ kind: "position_pause", position_ids: selected })}
          >
            Preview pause
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear selection
          </Button>
          <span className="text-xs text-muted-foreground">
            Closing or reopening roles stays a per-role decision.
          </span>
        </div>
      )}

      <BulkConfirmDialog
        request={bulkRequest}
        onClose={() => setBulkRequest(null)}
        onCommitted={() => setSelected([])}
      />

      <div className="rounded-lg border bg-card">
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-2">
                  <Checkbox
                    aria-label="Select all positions on this page"
                    checked={rows.length > 0 && selected.length === rows.length}
                    onCheckedChange={(v) =>
                      setSelected(v ? rows.map((r) => r.id) : [])
                    }
                  />
                </th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right" title="Delivered candidates">
                  Delivered
                </th>
                <th className="px-4 py-2 text-right">Shortlisted</th>
                <th className="px-4 py-2 text-right">Interviews</th>
                <th className="px-4 py-2 text-right">Action</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isError && rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-4">
                    <ErrorState
                      title="We couldn't load positions"
                      description="This is on our side. Your filters are still applied — try again."
                      onRetry={() => void listQuery.refetch()}
                    />
                  </td>
                </tr>
              ) : listQuery.isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                    Loading positions…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                    No positions match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                    data-position-id={p.id}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        aria-label={`Select ${p.title}`}
                        checked={selected.includes(p.id)}
                        onCheckedChange={(v) =>
                          setSelected((prev) =>
                            v ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                          )
                        }
                      />
                    </td>
                    <td className="max-w-[16rem] truncate px-4 py-3 font-medium">
                      <Link
                        to="/admin/positions/$id"
                        params={{ id: p.id }}
                        className="hover:underline"
                        aria-label={`Open ${p.title}`}
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.organizations ? (
                        <Link
                          to="/admin/clients/$id"
                          params={{ id: p.organizations.id }}
                          className="hover:underline"
                        >
                          {p.organizations.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.location ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_COLOR[p.status] ?? "bg-muted"}>
                        {p.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.counts.delivered}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.counts.shortlisted}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.counts.interviews}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.counts.action_required > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground dark:text-warning-foreground">
                          <AlertCircle className="h-3 w-3" />
                          {p.counts.action_required}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        asChild
                        size="sm"
                        variant="secondary"
                        data-qa-action="open-position"
                      >
                        <Link to="/admin/positions/$id" params={{ id: p.id }}>
                          Open <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y md:hidden">
          {listQuery.isError && rows.length === 0 ? (
            <div className="p-4">
              <ErrorState
                title="We couldn't load positions"
                description="This is on our side. Try again."
                onRetry={() => void listQuery.refetch()}
              />
            </div>
          ) : listQuery.isLoading && rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No positions match these filters.
            </div>
          ) : (
            rows.map((p) => (
              <Link
                key={p.id}
                to="/admin/positions/$id"
                params={{ id: p.id }}
                className="block space-y-2 p-4 active:bg-muted/40"
                data-position-id={p.id}
                data-qa-action="open-position"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {p.organizations?.name ?? "—"}
                      </span>
                      {p.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {p.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={STATUS_COLOR[p.status] ?? "bg-muted"}>
                    {p.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Delivered <b className="text-foreground">{p.counts.delivered}</b></span>
                  <span>Shortlisted <b className="text-foreground">{p.counts.shortlisted}</b></span>
                  <span>Interviews <b className="text-foreground">{p.counts.interviews}</b></span>
                  {p.counts.action_required > 0 && (
                    <span className="inline-flex items-center gap-1 text-warning-foreground dark:text-warning-foreground">
                      <AlertCircle className="h-3 w-3" />
                      {p.counts.action_required} action
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {payload.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={payload.page <= 1 || listQuery.isFetching}
              onClick={() => setSearch({ page: payload.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={payload.page >= totalPages || listQuery.isFetching}
              onClick={() => setSearch({ page: payload.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      </>
      )}
    </div>

  );
}
