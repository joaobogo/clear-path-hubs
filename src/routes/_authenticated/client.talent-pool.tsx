import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { Users, Search, GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/client/states";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client-context.functions";
import { listSilverMedalists } from "@/lib/talent-memory.functions";
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
  const ctxFn = useServerFn(getClientContext);
  const { data: ctx, isLoading: ctxLoading } = useQuery({
    queryKey: ["client-context"],
    queryFn: () => ctxFn({ data: {} }),
  });
  const orgId = ctx?.active?.organization_id;

  const poolFn = useServerFn(listSilverMedalists);
  const { data: pool, isLoading: poolLoading } = useQuery({
    queryKey: ["talent-pool-count", orgId],
    queryFn: () => poolFn({ data: { orgId: orgId!, status: "all" } }),
    enabled: !!orgId,
  });

  const hasPool = (pool?.memories?.length ?? 0) > 0;
  const loading = ctxLoading || poolLoading;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Talent pool</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your organization&apos;s private network of candidates.
        </p>
      </header>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-3">
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
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-medium">Previously shortlisted</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Candidates who reached the final stages of previous roles but were not hired.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary-foreground">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-medium">Direct applications</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Talent who applied directly to your company rather than a specific open role.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-medium">Passive network</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Candidates mapped or identified as high-potential for future organizational needs.
            </p>
          </div>
        </div>
      ) : null}

      <div className={hasPool ? "mt-12" : ""}>
        <EmptyState
          title="Building your talent pool"
          description="As you close roles and release candidates, your talent pool fills automatically. We surface relevant alumni when you open new roles."
        />
      </div>
    </div>
  );
}
