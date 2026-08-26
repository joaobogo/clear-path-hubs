import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  makeRouteErrorComponent,
  makeRouteNotFoundComponent,
} from "@/components/workspace/route-states";

export const Route = createFileRoute("/_authenticated/me/applications")({
  errorComponent: makeRouteErrorComponent("candidate", "/_authenticated/me/applications"),
  notFoundComponent: makeRouteNotFoundComponent("candidate"),
  component: () => <Outlet />,
});
