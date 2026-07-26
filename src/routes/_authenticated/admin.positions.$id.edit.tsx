import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PositionEditWizard } from "@/components/positions/PositionEditWizard";
import { getPositionForEdit } from "@/lib/position-edit.functions";

export const Route = createFileRoute("/_authenticated/admin/positions/$id/edit")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["position-edit", params.id],
      queryFn: () => getPositionForEdit({ data: { id: params.id } }),
    });
    if (!d) throw notFound();
    return d;
  },
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">Position not found.</div>
  ),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.positions.$id.edit.tsx"),
  head: () => ({ meta: [{ title: "Edit position · TaaSFlow admin" }] }),
  component: Page,
});

function Page() {
  const initial = Route.useLoaderData();
  return (
    <PositionEditWizard
      initial={initial}
      audience="admin"
      returnTo={`/admin/positions/${initial.id}`}
      invalidateKeys={[["admin-position", initial.id], ["admin-positions"], ["position-edit", initial.id]]}
    />
  );
}
