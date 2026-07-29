import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PositionEditWizard } from "@/components/positions/PositionEditWizard";
import { getPositionForEdit } from "@/lib/position-edit.functions";

export const Route = createFileRoute("/_authenticated/client/positions/$id/edit")({
 validateSearch: (search: Record<string, unknown>) => ({
  step: search.step ? Number(search.step) : undefined,
 }),
 loader: async ({ context, params }) => {
 const d = await context.queryClient.ensureQueryData({
 queryKey: ["client-position-edit", params.id],
 queryFn: () => getPositionForEdit({ data: { id: params.id } }),
 });
 if (!d) throw notFound();
 return d;
 },
 notFoundComponent: () => (
 <div className="p-10 text-center text-muted-foreground">Position not found.</div>
 ),
 errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.positions.$id.edit.tsx"),
 head: () => ({ meta: [{ title: "Edit position · TaaSFlow" }] }),
 component: Page,
});

function Page() {
 const initial = Route.useLoaderData();
 const { step } = Route.useSearch();
 return (
 <PositionEditWizard
 initial={initial}
 initialStep={step}
 audience="client"
 returnTo={`/client/positions/${initial.id}`}
 invalidateKeys={[
 ["client-position", initial.id],
 ["client-positions"],
 ["client-position-edit", initial.id],
 ]}
 />
 );
}
