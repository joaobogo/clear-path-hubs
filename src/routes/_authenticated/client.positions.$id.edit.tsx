import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PositionEditWizard } from "@/components/positions/PositionEditWizard";
import { getPositionForEdit } from "@/lib/position-edit.functions";

export const Route = createFileRoute("/_authenticated/client/positions/$id/edit")({
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
 errorComponent: ({ error, reset }) => {
 const router = useRouter();
 return (
 <div className="mx-auto max-w-xl space-y-3 p-10 text-center">
 <h1 className="text-lg font-semibold text-destructive">Couldn't load position</h1>
 <p className="text-sm text-muted-foreground">{error.message}</p>
 <Button
 onClick={() => {
 reset();
 router.invalidate();
 }}
 >
 Try again
 </Button>
 </div>
 );
 },
 head: () => ({ meta: [{ title: "Edit position · TaaSFlow" }] }),
 component: Page,
});

function Page() {
 const initial = Route.useLoaderData();
 return (
 <PositionEditWizard
 initial={initial}
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
