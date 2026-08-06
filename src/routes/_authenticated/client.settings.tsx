import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceTab } from "@/components/client/account/workspace-tab";

// The client Account area now owns the full tab set (Workspace, Branding,
// Notifications) via src/components/client/account/*. This route is kept
// as a thin page rendering the Workspace tab only; another agent will turn
// it into a redirect into the Account area.
export const Route = createFileRoute("/_authenticated/client/settings")({
 head: () => ({
 meta: [
 { title: "Settings · Client workspace" },
 { name: "robots", content: "noindex" },
 ],
 }),
 errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.settings.tsx"),
 component: SettingsPage,
});

function SettingsPage() {
 return (
 <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
 <header className="mb-6">
 <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
 Settings
 </div>
 <h1 className="mt-1 text-2xl font-semibold tracking-tight">Workspace</h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Manage your workspace details and account preferences.
 </p>
 </header>
 <WorkspaceTab />
 </main>
 );
}
