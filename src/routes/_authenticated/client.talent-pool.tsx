import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { useConfirmAction } from "@/components/ds";
import {
  Sparkles,
  Search,
  Filter,
  Plus,
  Trash2,
  Users,
  MapPin,
  Clock,
  Star,
  BookmarkPlus,
  ArrowUpRight,
} from "lucide-react";
import {
  listPools,
  createPool,
  deletePool,
  addToPool,
  removeFromPool,
  toggleGoodForFuture,
  searchRediscovery,
  getRediscoveryFacets,
  type RediscoveryCandidateDTO,
  type TalentPoolDTO,
} from "@/lib/talent-pool.functions";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { RoleFitPanel } from "@/components/client/role-fit-panel";
import { QueryErrorCard } from "@/components/client/query-error";
import { SkeletonCards } from "@/components/client/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const searchSchema = z.object({
  pool: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  stage: fallback(z.string(), "").default(""),
  position: fallback(z.string(), "").default(""),
  geo: fallback(z.string(), "").default(""),
  seniority: fallback(z.string(), "").default(""),
  recency: fallback(z.number(), 0).default(0),
  future: fallback(z.boolean(), false).default(false),
  silver: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_authenticated/client/talent-pool")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Talent pool · Rediscovery" },
      {
        name: "description",
        content:
          "Search and rediscover past candidates by skill, stage, role, geography, and recency. Save named pools for reuse across future roles.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.talent-pool.tsx"),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Not found.</div>
  ),
  component: TalentPoolPage,
});

function TalentPoolPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const poolsFn = useServerFn(listPools);
  const facetsFn = useServerFn(getRediscoveryFacets);
  const searchFn = useServerFn(searchRediscovery);

  const {
    data: ctx,
    isError: ctxIsError,
    error: ctxError,
    isFetching: ctxIsFetching,
    refetch: refetchCtx,
  } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const readOnly = ctx?.active?.role === "client_viewer";

  const {
    data: poolsData,
    isError: poolsIsError,
    error: poolsError,
    isFetching: poolsIsFetching,
    refetch: refetchPools,
  } = useQuery({
    queryKey: ["talent-pool", "pools", orgId],
    queryFn: () => poolsFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const pools = poolsData?.pools ?? [];

  const {
    data: facets,
    isError: facetsIsError,
    error: facetsError,
    isFetching: facetsIsFetching,
    refetch: refetchFacets,
  } = useQuery({
    queryKey: ["talent-pool", "facets", orgId],
    queryFn: () => facetsFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const filters = useMemo(
    () => ({
      q: search.q || undefined,
      stage: search.stage || undefined,
      positionId: search.position || undefined,
      geo: search.geo || undefined,
      seniority: search.seniority || undefined,
      recencyDays: search.recency > 0 ? search.recency : undefined,
      poolId: search.pool || undefined,
      goodForFutureOnly: search.future || undefined,
      silverOnly: search.silver || undefined,
    }),
    [search],
  );

  const {
    data: results,
    isPending,
    isError: resultsIsError,
    error: resultsError,
    isFetching: resultsIsFetching,
    refetch: refetchResults,
  } = useQuery({
    queryKey: ["talent-pool", "search", orgId, filters],
    queryFn: () => searchFn({ data: { orgId: orgId!, ...filters, limit: 200 } }),
    enabled: !!orgId,
  });

  const [qDraft, setQDraft] = useState(search.q);
  const activePool = pools.find((p) => p.id === search.pool) ?? null;
  const filterCount =
    (search.stage ? 1 : 0) +
    (search.position ? 1 : 0) +
    (search.geo ? 1 : 0) +
    (search.seniority ? 1 : 0) +
    (search.recency ? 1 : 0) +
    (search.future ? 1 : 0) +
    (search.silver ? 1 : 0);

  if (ctxIsError) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <QueryErrorCard
          title="We couldn't load your workspace"
          error={ctxError}
          onRetry={() => refetchCtx()}
          retrying={ctxIsFetching}
        />
      </div>
    );
  }

  if (!orgId) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Sparkles className="h-6 w-6 text-primary" aria-hidden />
            Talent pool
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rediscover every candidate you&apos;ve ever seen. Filter by skill, stage,
            role, location, or recency. Save pools for reuse.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {resultsIsError ? "— candidates" : `${results?.total ?? 0} candidates`}
        </div>
      </header>

      <div className="mt-6">
        <RoleFitPanel orgId={orgId} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Pools sidebar */}
        <aside className="space-y-2">
          {poolsIsError ? (
            <QueryErrorCard
              compact
              title="We couldn't load your pools"
              error={poolsError}
              onRetry={() => refetchPools()}
              retrying={poolsIsFetching}
            />
          ) : (
            <>
              <PoolButton
                active={!search.pool}
                onClick={() =>
                  navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, pool: "", future: false }) })
                }
                label="All past candidates"
                count={undefined}
              />
              {pools.map((p) => (
                <PoolButton
                  key={p.id}
                  active={search.pool === p.id}
                  onClick={() =>
                    navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, pool: p.id, future: false }) })
                  }
                  label={p.name}
                  count={p.member_count}
                  isSystem={p.is_system}
                />
              ))}
              {!readOnly && (
                <CreatePoolDialog
                  orgId={orgId}
                  onCreated={(id) =>
                    navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, pool: id }) })
                  }
                />
              )}
            </>
          )}
        </aside>

        <div>
          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, q: qDraft }) });
              }}
            >
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="Search by name, headline, skill…"
                className="h-9 w-72 pl-8"
              />
            </form>

            <FiltersPopover
              search={search}
              onChange={(patch) =>
                navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, ...patch }) })
              }
              stages={facets?.stages ?? []}
              seniorities={facets?.seniorities ?? []}
              positions={facets?.positions ?? []}
              filterCount={filterCount}
            />
            {facetsIsError && (
              <QueryErrorCard
                compact
                title="Filter options failed to load"
                error={facetsError}
                onRetry={() => refetchFacets()}
                retrying={facetsIsFetching}
              />
            )}

            <QuickChip
              active={search.silver}
              onClick={() => navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, silver: !s.silver }) })}
              icon={<Star className="h-3 w-3" />}
              label="Silver medalists"
            />
            <QuickChip
              active={search.future}
              onClick={() =>
                navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, future: !s.future, pool: "" }) })
              }
              icon={<Sparkles className="h-3 w-3" />}
              label="Good for future"
            />
            {(search.q || filterCount > 0) && (
              <button
                onClick={() => {
                  setQDraft("");
                  navigate({
                    search: () => ({
                      pool: search.pool,
                      q: "",
                      stage: "",
                      position: "",
                      geo: "",
                      seniority: "",
                      recency: 0,
                      future: false,
                      silver: false,
                    }),
                  });
                }}
                className="ml-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {activePool && (
            <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2 text-xs">
              <span>
                Viewing pool <span className="font-medium">{activePool.name}</span>
                {activePool.description && ` — ${activePool.description}`}
              </span>
              {!activePool.is_system && !readOnly && (
                <DeletePoolButton orgId={orgId} pool={activePool} />
              )}
            </div>
          )}

          {/* Results */}
          <div className="mt-4">
            {resultsIsError ? (
              <QueryErrorCard
                title="We couldn't load candidates"
                error={resultsError}
                onRetry={() => refetchResults()}
                retrying={resultsIsFetching}
              />
            ) : isPending ? (
              <SkeletonCards cards={3} />
            ) : (results?.candidates ?? []).length === 0 ? (
              <EmptyState hasFilters={!!search.q || filterCount > 0 || !!search.pool} />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(results?.candidates ?? []).map((c) => (
                  <RediscoveryCard
                    key={c.candidate_profile_id}
                    candidate={c}
                    orgId={orgId}
                    pools={pools}
                    activePoolId={search.pool || null}
                    readOnly={readOnly}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function PoolButton({
  active,
  onClick,
  label,
  count,
  isSystem,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number | undefined;
  isSystem?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
        active
          ? "border-primary bg-primary/5 text-foreground"
          : "border-transparent hover:bg-muted"
      }`}
    >
      <span className="flex items-center gap-1.5">
        {isSystem && <Sparkles className="h-3 w-3 text-primary" />}
        {label}
      </span>
      {typeof count === "number" && (
        <Badge variant="outline" className="text-[10px]">
          {count}
        </Badge>
      )}
    </button>
  );
}

function QuickChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FiltersPopover({
  search,
  onChange,
  stages,
  seniorities,
  positions,
  filterCount,
}: {
  search: z.infer<typeof searchSchema>;
  onChange: (patch: Partial<z.infer<typeof searchSchema>>) => void;
  stages: string[];
  seniorities: string[];
  positions: { id: string; title: string }[];
  filterCount: number;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <Filter className="h-3.5 w-3.5" /> Filters
          {filterCount > 0 && (
            <Badge className="ml-1 h-4 px-1 text-[10px]">{filterCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Stage</label>
          <Select
            value={search.stage || "all"}
            onValueChange={(v) => onChange({ stage: v === "all" ? "" : v })}
          >
            <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any stage</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <Select
            value={search.position || "all"}
            onValueChange={(v) => onChange({ position: v === "all" ? "" : v })}
          >
            <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="Any role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any role</SelectItem>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Seniority</label>
          <Select
            value={search.seniority || "all"}
            onValueChange={(v) => onChange({ seniority: v === "all" ? "" : v })}
          >
            <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any seniority</SelectItem>
              {seniorities.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Location</label>
          <Input
            className="mt-1 h-8"
            placeholder="e.g. Berlin, remote EU"
            value={search.geo}
            onChange={(e) => onChange({ geo: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Recency</label>
          <Select
            value={String(search.recency || 0)}
            onValueChange={(v) => onChange({ recency: Number(v) })}
          >
            <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any time</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="1095">Last 3 years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CreatePoolDialog({
  orgId,
  onCreated,
}: {
  orgId: string;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createPool);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { orgId, name, description: description || undefined } }),
    onSuccess: (r) => {
      toast.success(`Pool "${name}" created`);
      qc.invalidateQueries({ queryKey: ["talent-pool", "pools", orgId] });
      setOpen(false);
      setName("");
      setDescription("");
      onCreated(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New pool
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create talent pool</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              className="mt-1"
              placeholder="e.g. Senior engineers — Berlin"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Description (optional)
            </label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Why this pool exists, who belongs, when to revisit…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePoolButton({
  orgId,
  pool,
}: {
  orgId: string;
  pool: TalentPoolDTO;
}) {
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const delFn = useServerFn(deletePool);
  const del = useMutation({
    mutationFn: () => delFn({ data: { orgId, id: pool.id } }),
    onSuccess: () => {
      toast.success(`Pool "${pool.name}" deleted`);
      qc.invalidateQueries({ queryKey: ["talent-pool", "pools", orgId] });
      navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, pool: "" }) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const { confirm, confirmDialog } = useConfirmAction();
  return (
    <>
      <button
        type="button"
        disabled={del.isPending}
        aria-busy={del.isPending || undefined}
        onClick={async () => {
          const r = await confirm({
            title: "Delete pool",
            object: pool.name,
            description: "The pool disappears from your workspace.",
            impact: [
              "Candidates are not removed — they stay in other pools",
              "Anyone in your workspace loses this saved grouping",
            ],
            confirmLabel: "Delete pool",
            tone: "destructive",
          });
          if (r.confirmed) del.mutate();
        }}
        className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
      >
        <Trash2 className="h-3 w-3" /> {del.isPending ? "Deleting…" : "Delete pool"}
      </button>
      {confirmDialog}
    </>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 font-medium">
        {hasFilters ? "No candidates match those filters" : "No past candidates yet"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters
          ? "Try loosening a filter, clearing your query, or switching to a different pool."
          : "As candidates flow through your positions, they'll be searchable here forever."}
      </p>
    </div>
  );
}

function RediscoveryCard({
  candidate,
  orgId,
  pools,
  activePoolId,
  readOnly,
}: {
  candidate: RediscoveryCandidateDTO;
  orgId: string;
  pools: TalentPoolDTO[];
  activePoolId: string | null;
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const addFn = useServerFn(addToPool);
  const removeFn = useServerFn(removeFromPool);
  const gffFn = useServerFn(toggleGoodForFuture);

  const addTo = useMutation({
    mutationFn: (poolId: string) =>
      addFn({
        data: {
          orgId,
          poolId,
          candidate_profile_ids: [candidate.candidate_profile_id],
        },
      }),
    onSuccess: () => {
      toast.success("Added to pool");
      qc.invalidateQueries({ queryKey: ["talent-pool"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeFromActive = useMutation({
    mutationFn: (poolId: string) =>
      removeFn({
        data: {
          orgId,
          poolId,
          candidate_profile_id: candidate.candidate_profile_id,
        },
      }),
    onSuccess: () => {
      toast.success("Removed from pool");
      qc.invalidateQueries({ queryKey: ["talent-pool"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const gff = useMutation({
    mutationFn: () =>
      gffFn({
        data: {
          orgId,
          candidate_profile_id: candidate.candidate_profile_id,
          on: !candidate.is_good_for_future,
        },
      }),
    onSuccess: () => {
      toast.success(
        candidate.is_good_for_future
          ? "Removed from Good for future"
          : "Marked good for future role",
      );
      qc.invalidateQueries({ queryKey: ["talent-pool"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stageLabel = candidate.last_stage?.replace(/_/g, " ") ?? "—";
  const days = Math.max(
    1,
    Math.round(
      (Date.now() - new Date(candidate.last_activity_at).getTime()) / 86400_000,
    ),
  );

  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{candidate.display_name}</p>
          {candidate.headline && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {candidate.headline}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-1">
          {candidate.is_silver && (
            <Badge className="border-amber-300/60 bg-amber-100/60 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 text-[10px]">
              <Star className="mr-0.5 h-2.5 w-2.5" /> silver
            </Badge>
          )}
          {candidate.is_good_for_future && (
            <Badge className="border-primary/40 bg-primary/10 text-primary text-[10px]">
              <Sparkles className="mr-0.5 h-2.5 w-2.5" /> future
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {candidate.seniority && <span>{candidate.seniority}</span>}
        {candidate.location && (
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="h-3 w-3" /> {candidate.location}
          </span>
        )}
        <span className="inline-flex items-center gap-0.5">
          <Clock className="h-3 w-3" /> {days}d ago
        </span>
      </div>

      {candidate.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {candidate.skills.slice(0, 6).map((s) => (
            <Badge key={s} variant="outline" className="text-[10px] font-normal">
              {s}
            </Badge>
          ))}
          {candidate.skills.length > 6 && (
            <span className="text-[10px] text-muted-foreground">
              +{candidate.skills.length - 6}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 rounded-md border bg-muted/30 px-2.5 py-1.5 text-[11px]">
        Last role:{" "}
        <span className="font-medium">
          {candidate.last_role_title ?? "Untitled"}
        </span>{" "}
        · stage <span className="capitalize">{stageLabel}</span>
        {candidate.match_count > 1 && ` · seen ${candidate.match_count}×`}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          disabled={readOnly || gff.isPending}
          onClick={() => gff.mutate()}
        >
          <Sparkles className="h-3 w-3" />
          {candidate.is_good_for_future ? "In future" : "Good for future"}
        </Button>

        {!readOnly && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                <BookmarkPlus className="h-3 w-3" /> Add to pool
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              {pools.filter((p) => !p.is_system).length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">
                  No custom pools yet. Create one from the sidebar.
                </p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {pools
                    .filter((p) => !p.is_system)
                    .map((p) => {
                      const inPool = candidate.pool_ids.includes(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                            onClick={() =>
                              inPool
                                ? removeFromActive.mutate(p.id)
                                : addTo.mutate(p.id)
                            }
                          >
                            <span>{p.name}</span>
                            {inPool && <span className="text-primary">✓</span>}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              )}
            </PopoverContent>
          </Popover>
        )}

        {activePoolId && !readOnly && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => removeFromActive.mutate(activePoolId)}
          >
            <Trash2 className="h-3 w-3" /> Remove
          </Button>
        )}

        {candidate.last_position_id && (
          <Link
            to="/client/positions/$id"
            params={{ id: candidate.last_position_id }}
            className="ml-auto inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
          >
            View role <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </li>
  );
}
