import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { Users, Search, GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/client/states";

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
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Talent pool</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your organization's private network of candidates.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-medium">Silver medalists</h3>
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

      <div className="mt-12">
        <EmptyState
          title="Building your talent pool"
          description="As you close roles and release candidates, your talent pool fills automatically. We surface relevant alumni when you open new roles."
        />
      </div>
    </div>
  );
}
