import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ViewerReadOnlyNotice } from "@/components/client/states";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  Sparkles,
  Search,
  Users,
  Star,
} from "lucide-react";
import { plural } from "@/lib/format/plural";
import {
  listPools,
  searchRediscovery,
  getRediscoveryFacets,
} from "@/lib/talent-pool.functions";
import { getClientContext } from "@/lib/client-context.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { RoleFitPanel } from "@/components/client/role-fit-panel";
import { QueryErrorCard } from "@/components/client/query-error";
import { SkeletonCards } from "@/components/client/states";
import { Input } from "@/components/ui/input";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { PoolButton } from "@/components/client/talent-pool/pool-button";
import { QuickChip } from "@/components/client/talent-pool/quick-chip";
import { FiltersPopover } from "@/components/client/talent-pool/filters-popover";
import { CreatePoolDialog } from "@/components/client/talent-pool/create-pool-dialog";
import { DeletePoolButton } from "@/components/client/talent-pool/delete-pool-button";
import { EmptyState } from "@/components/client/talent-pool/empty-state";
import { RediscoveryCard } from "@/components/client/talent-pool/rediscovery-card";

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

export const RoutePending = makeWorkspacePending({ shape: "cards", width: "7xl" });

export const Route = createFileRoute("/_authenticated/client/talent-pool")({
	pendingMs: 150,
	pendingComponent: RoutePending,
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

  if (!orgId) return <RoutePending />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
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
          {resultsIsError ? "— candidates" : plural(results?.total ?? 0, "candidate")}
        </div>
      </header>

      {readOnly ? (
        <ViewerReadOnlyNotice className="mt-5" area="saving pools and tagging candidates" />
      ) : null}

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
                <DeletePoolButton
                  orgId={orgId}
                  pool={activePool}
                  onDeleted={() =>
                    navigate({ search: (s: z.infer<typeof searchSchema>) => ({ ...s, pool: "" }) })
                  }
                />
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
    </div>
  );
}
