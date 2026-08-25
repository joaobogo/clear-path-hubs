import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useState } from "react";
import { EmptyState, ErrorState } from "@/components/client/states";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client-context.functions";
import { listSilverMedalists } from "@/lib/talent-memory.functions";
import { MemoryCard } from "@/components/client/talent-memory/memory-list";
import { MemorySheet } from "@/components/client/talent-memory/memory-sheet";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/client/talent-pool")({
  head: () => ({
    meta: [
      { title: "Talent pool · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.talent-pool.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  component: TalentPoolPage,
});

function TalentPoolPage() {
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

  const poolFn = useServerFn(listSilverMedalists);
  const {
    data: pool,
    isLoading: poolLoading,
    isError: poolError,
    refetch: refetchPool,
  } = useQuery({
    queryKey: ["talent-pool-count", orgId],
    queryFn: () => poolFn({ data: { orgId: orgId!, status: "all" } }),
    enabled: !!orgId,
  });

  const memories = pool?.memories ?? [];
  const hasPool = memories.length > 0;
  const loading = ctxLoading || poolLoading;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
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
      ) : hasPool ? (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} onOpen={() => setOpenId(memory.id)} />
            ))}
          </ul>
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
