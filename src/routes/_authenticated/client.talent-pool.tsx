import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useMemo, useState } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { EmptyState, ErrorState } from "@/components/client/states";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client-context.functions";
import { listSilverMedalists, type SilverReason, type TalentMemoryDTO } from "@/lib/talent-memory.functions";
import { MemoryCard } from "@/components/client/talent-memory/memory-list";
import { MemorySheet } from "@/components/client/talent-memory/memory-sheet";
import { PoolFilters, type PoolFilterState } from "@/components/client/talent-memory/pool-filters";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  reason: fallback(z.string(), "all").default("all"),
  consent: fallback(z.string(), "all").default("all"),
  skill: fallback(z.string(), "").default(""),
  // Archived entries are on file but not in play, so the default view is active
  // only — with the count of what is hidden stated below the list.
  status: fallback(z.enum(["active", "archived", "all"]), "active").default("active"),
});

export const Route = createFileRoute("/_authenticated/client/talent-pool")({
  head: () => ({
    meta: [
      { title: "Talent pool · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: zodValidator(searchSchema),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.talent-pool.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  component: TalentPoolPage,
});

function TalentPoolPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);

  const ctxFn = useServerFn(getClientContext);
  const {
    data: ctx,
    isLoading: ctxLoading,
    isError: ctxError,
    refetch: refetchCtx,
  } = useQuery({
    queryKey: ["client-context"],
    queryFn: () => ctxFn({ data: {} }),
  });
  const orgId = ctx?.active?.organization_id;

  // The unfiltered set backs the skill list and the "N of M" denominator, so
  // both stay stable while the user narrows the view. Reason and search run
  // client-side against these rows for the same reason.
  const poolFn = useServerFn(listSilverMedalists);
  const {
    data: pool,
    isLoading: poolLoading,
    isError: poolError,
    refetch: refetchPool,
  } = useQuery({
    // Version the result shape so clients cannot keep the older cached list
    // that omitted saved candidates who were still active on their source role.
    queryKey: ["talent-pool", "all-saved-v2", orgId, search.status],
    queryFn: () => poolFn({ data: { orgId: orgId!, status: search.status } }),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });

  const allMemories = useMemo(() => pool?.memories ?? [], [pool]);

  const skillOptions = useMemo(
    () =>
      Array.from(new Set(allMemories.flatMap((m) => m.skills_snapshot)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [allMemories],
  );

  const filtered = useMemo(
    () => filterMemories(allMemories, search),
    [allMemories, search],
  );

  const setF = (patch: Partial<PoolFilterState>) =>
    navigate({ search: { ...search, ...patch } as never });

  const hasAnyEntries = allMemories.length > 0;
  const loading = ctxLoading || poolLoading;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Talent pool</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your organization&apos;s private network of candidates.
        </p>
      </header>

      {ctxError || poolError ? (
        <ErrorState
          title="We couldn't load your talent pool"
          onRetry={() => {
            if (ctxError) void refetchCtx();
            if (poolError) void refetchPool();
          }}
        />
      ) : loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-6 shadow-sm">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="mt-4 h-5 w-2/3" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-1 h-4 w-5/6" />
            </div>
          ))}
        </div>
      ) : hasAnyEntries ? (
        <>
          <PoolFilters
            filters={search}
            setF={setF}
            skillOptions={skillOptions}
            resultCount={filtered.length}
            totalCount={allMemories.length}
          />

          {/* A filtered-to-empty pool is not an empty pool. Saying so, and
              offering the way back, keeps the two states distinguishable. */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <h2 className="font-medium">No candidates match these filters</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {allMemories.length} {allMemories.length === 1 ? "candidate is" : "candidates are"} in
                your pool. Widen or clear the filters to see them.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setF({ q: "", reason: "all", consent: "all", status: "active", skill: "" })
                }
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} onOpen={() => setOpenId(memory.id)} />
              ))}
            </ul>
          )}

          {orgId && (
            <MemorySheet orgId={orgId} id={openId} readOnly={false} onClose={() => setOpenId(null)} />
          )}
        </>
      ) : (
        <EmptyState
          title="Building your talent pool"
          description="As you close roles and release candidates, your talent pool fills automatically. We surface relevant alumni when you open new roles."
        />
      )}
    </div>
  );
}

/**
 * Reason, consent, skill and free text narrow the rows the server returned for
 * the chosen status. Kept as a plain function so the predicates are testable
 * without rendering the page.
 */
export function filterMemories(
  memories: TalentMemoryDTO[],
  f: { q: string; reason: string; consent: string; skill: string },
): TalentMemoryDTO[] {
  const term = f.q.trim().toLowerCase();
  const skill = f.skill.trim().toLowerCase();

  return memories.filter((m) => {
    if (f.reason !== "all" && m.reason_category !== (f.reason as SilverReason)) return false;
    if (f.consent !== "all" && m.consent_status !== f.consent) return false;
    if (skill && !m.skills_snapshot.some((s) => s.toLowerCase() === skill)) return false;
    if (term) {
      const hay = [
        m.candidate.display_name,
        m.candidate.headline ?? "",
        m.role_title_snapshot ?? "",
        m.reason_notes ?? "",
        m.candidate.location ?? "",
        ...m.skills_snapshot,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}
