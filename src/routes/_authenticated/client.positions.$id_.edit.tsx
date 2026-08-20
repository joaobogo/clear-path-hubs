import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, notFound, redirect, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PositionEditWizard } from "@/components/positions/PositionEditWizard";
import { getPositionForEdit } from "@/lib/position-edit.functions";

export const Route = createFileRoute("/_authenticated/client/positions/$id_/edit")({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search.step ? Number(search.step) : undefined;
    const step = raw && raw >= 1 && raw <= 3 ? raw : undefined;
    return { step };
  },
 loader: async ({ context, params }) => {
 let d;
 try {
  d = await context.queryClient.ensureQueryData({
   queryKey: ["client-position-edit", params.id],
   queryFn: () => getPositionForEdit({ data: { id: params.id } }),
  });
 } catch (e) {
  // A seat without edit rights should still be able to open its own role:
  // fall back to the read-only role page instead of a permission wall.
  const msg = e instanceof Error ? e.message.replace(/^Error: /, "") : "";
  if (msg.includes("forbidden")) {
   throw redirect({ to: "/client/positions/$id", params: { id: params.id } });
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
