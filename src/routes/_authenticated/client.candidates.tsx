import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/client/candidates")({
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.candidates.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
 component: () => <Outlet />,
});
