import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { TeamTab } from "@/components/client/account/team-tab";

const RoutePending = makeWorkspacePending({ shape: "rows", kpis: false, width: "6xl" });
export const Route = createFileRoute("/_authenticated/client/team")({
	pendingMs: 150,
	pendingComponent: RoutePending,
 head: () => ({
 meta: [
 { title: "Team · Client workspace" },
 { name: "robots", content: "noindex" },
 ],
 }),
 errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.team.tsx"),
 component: TeamTab,
});
