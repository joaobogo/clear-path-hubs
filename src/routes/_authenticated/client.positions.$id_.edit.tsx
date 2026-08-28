import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, notFound, redirect, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PositionEditWizard } from "@/components/positions/PositionEditWizard";
import { getPositionForEdit } from "@/lib/position-edit.functions";
import { kpiCacheKeys } from "@/lib/kpis/cache-keys";

export const Route = createFileRoute("/_authenticated/client/positions/$id_/edit")({
  validateSearch: (search: Record<string, unknown>): { step?: number; fresh?: boolean } => {
    const raw = search.step ? Number(search.step) : undefined;
    const step = raw && raw >= 1 && raw <= 3 ? raw : undefined;
    // Set right after "New role": the screen is titled for creation, not editing.
    const fresh = search.fresh === true || search.fresh === "true" ? true : undefined;
    return { step, fresh };
  },


 loader: async ({ context, params, location }) => {
 let d;
 try {
  d = await context.queryClient.ensureQueryData({
   queryKey: ["client-position-edit", params.id],
   queryFn: () => getPositionForEdit({ data: { id: params.id } }),
  });
 } catch (e) {
  // A seat without edit rights should still be able to open its own role:
  // fall back to the read-only role page instead of a permission wall.
  // Search params ride along — staff org-preview context lives there.
  const msg = e instanceof Error ? e.message.replace(/^Error: /, "") : "";
  if (msg.includes("forbidden")) {
   throw redirect({
    to: "/client/positions/$id",
    params: { id: params.id },
    search: location.search as Record<string, unknown>,
   });
  }
  throw e;
 }
 if (!d) throw notFound();
 return d;
 },
 notFoundComponent: () => (
 <div className="p-10 text-center text-muted-foreground">Role not found.</div>
 ),
 errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.positions.$id.edit.tsx"),
 head: () => ({ meta: [{ title: "Edit role · Client workspace" }] }),
 component: Page,
});

function Page() {
 const initial = Route.useLoaderData();
 const { step, fresh } = Route.useSearch();
 return (
 <PositionEditWizard
 initial={initial}
 initialStep={step}
 mode={fresh ? "create" : "edit"}
 audience="client"

 returnTo={`/client/positions/${initial.id}`}
 invalidateKeys={[
  kpiCacheKeys.client.position(initial.id),
  kpiCacheKeys.client.positions(),
  kpiCacheKeys.client.positionEdit(initial.id),
  kpiCacheKeys.client.overview(),
 ]}
 />
 );
}
