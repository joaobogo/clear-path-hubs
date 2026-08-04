import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import {
  makeRouteErrorComponent,
  makeRouteNotFoundComponent,
} from "@/components/workspace/route-states";
import { ACTIVITY_QUERY_KEY } from "@/components/activity/ActivityFeed";
import { AGENT_RAIL_QUERY_KEY } from "@/components/client/agent-activity-rail";
import { SYSTEM_HEALTH_QUERY_KEY } from "@/components/client/system-health-strip";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getClientContext } from "@/lib/client.functions";
import { startSupportSession } from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";
import { NOTIFICATIONS_QUERY_KEY } from "@/components/notification-bell";
import { useDashboardRealtime } from "@/hooks/use-realtime-refresh";
import { SupportViewBanner } from "@/components/support-view-banner";
import {
 SupportViewContext,
 type SupportViewState,
 type PermissionPreview,
} from "@/lib/support-view";
import { ClientOnboardingModal } from "@/components/client/onboarding-modal";
import {
 LayoutDashboard,
 Briefcase,
 Users,
 MessageSquare,
 UserCog,
 Building2,
	Settings,
	Award,
	Database,
	Bot,
	CheckSquare,
	Gauge,
 	Plus,
 	Send,
 	CreditCard,
} from "lucide-react";
import {
 WorkspaceShell,
 type WorkspaceNavItem,
} from "@/components/workspace/workspace-shell";
import { ClientBrandHeader } from "@/components/client/client-brand-header";
import { SectionTabs } from "@/components/workspace/section-tabs";
import { CLIENT_SECTION_GROUPS } from "@/config/workspace-sections";
import { OrgSwitcher } from "@/components/workspace/org-switcher";
import { EmptyState, PermissionDenied } from "@/components/client/states";

const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);
const searchSchema = z.object({
 org: z.preprocess(emptyToUndef, z.string().uuid().optional()),
 preview: z.preprocess(
 emptyToUndef,
 z.enum(["client_admin", "client_editor", "client_viewer"]).optional(),
 ),
});

export const Route = createFileRoute("/_authenticated/client")({
  errorComponent: makeRouteErrorComponent("client", "/_authenticated/client"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
 validateSearch: searchSchema,
 loaderDeps: ({ search }) => ({ org: search.org ?? null }),
 head: () => ({
 meta: [
 { title: "Client workspace · TaaSFlow" },
 { name: "robots", content: "noindex" },
 ],
 }),
 loader: async ({ context, deps }) => {
 const ctx = await context.queryClient.ensureQueryData({
 queryKey: ["client-context", deps.org],
 queryFn: () =>
 getClientContext({ data: deps.org ? { orgId: deps.org } : {} }),
 });
 // Route-level organization guard. `getClientContext` only ever resolves an
 // active organization the caller is an active member of (or any org when the
 // caller is platform staff), so a missing `active` here means the requested
 // ?org= is not theirs — or they have no client membership at all. Both fail
 // closed to the intentional access-denied screen rather than a silent bounce.
 // This is supplementary: RLS blocks the underlying data either way.
 if (!ctx.active && ctx.organizations.length === 0 && !ctx.isStaff) {
 throw redirect({ to: "/access-denied", search: { reason: "membership" } });
 }
 // A named ?org= that did not resolve means the caller is not a member of it.
 if (!ctx.active && deps.org) {
 throw redirect({ to: "/access-denied", search: { reason: "organization" } });
 }

 return ctx;
 },

 component: ClientLayout,
});

type NavDef = WorkspaceNavItem & { everyone: boolean };

// Part 9 subtraction: nine entries instead of fifteen. Everything that used to
// have its own sidebar row now lives as a tab inside one of these sections
// (see src/config/workspace-sections.ts).
const TABS: NavDef[] = [
	{ to: "/client", label: "Overview", icon: LayoutDashboard, exact: true, everyone: true, hint: "What needs you today" },
	{ to: "/client/positions", label: "Roles", icon: Briefcase, everyone: true, hint: "Roles, interviews, offers, deliveries" },
	{ to: "/client/candidates", label: "Candidates", icon: Users, everyone: true, hint: "Shortlist, talent pool, shared links" },
	{ to: "/client/tasks", label: "Approvals", icon: CheckSquare, everyone: true, hint: "Decisions waiting on you" },
	{ to: "/client/conversations", label: "Messages", icon: MessageSquare, everyone: true, hint: "One thread per role and candidate" },
	{ to: "/client/analytics", label: "Insights", icon: Gauge, everyone: true, hint: "Questions, dashboards, your data" },
	{ to: "/client/assistant", label: "Assistant", icon: Bot, everyone: true, hint: "Assistant, agents, outreach" },
	{ to: "/client/talent-memory", label: "Talent memory", icon: Award, everyone: true, hint: "People we already know" },
	{ to: "/client/onboarding", label: "Setup", icon: Settings, everyone: false, hint: "Configure your hiring system" },
	{ to: "/client/account", label: "Account", icon: Building2, everyone: false, hint: "Team, plan, settings" },
];

// Manage-only areas are gated by path, not by whether they appear in the rail —
// several of them are now tabs inside the Account section.
const MANAGE_ONLY_LABELS: Record<string, string> = {
	"/client/account": "Account",
	"/client/team": "Team",
	"/client/plan": "Plan & billing",
	"/client/settings": "Settings",
};
const MANAGE_ONLY_PATHS = Object.keys(MANAGE_ONLY_LABELS);

function ClientLayout() {
 const ctx = Route.useLoaderData();
 const search = Route.useSearch();
 const pathname = useRouterState({ select: (st) => st.location.pathname });
 const getCtx = useServerFn(getClientContext);
 const { data } = useQuery({
 queryKey: ["client-context", search.org ?? null],
 queryFn: () => getCtx({ data: search.org ? { orgId: search.org } : {} }),
 initialData: ctx,
 });

 // Realtime + focus + interval fallback is owned by ClientCoordinator below,
 // which subscribes exactly once to `notifications` for this user. Do not add
 // per-table channels here — Realtime is only enabled on `notifications`,
 // `notification_events`, and `messages`, and duplicate subscriptions on
 // `candidate_matches` (previously here) were silently no-ops.

 const active = data?.active;

 const staffMembershipsElsewhere =
 (data?.isStaff ?? false) &&
 active != null &&
 !data!.organizations.some((o: { id: string }) => o.id === active.organization_id);

 const [supportSessionId, setSupportSessionId] = useState<string | null>(null);
 const permissionPreview: PermissionPreview =
 (search.preview as PermissionPreview | undefined) ?? "client_admin";
 const startSession = useMutation({
 mutationFn: (input: { organization_id: string; permission_preview: PermissionPreview }) =>
 startSupportSession({ data: { ...input, mode: "read_only" } }),
 onSuccess: (r) => setSupportSessionId(r.session_id),
 onError: (e: Error) => console.warn("[support-view] session log failed", e.message),
 });
 useEffect(() => {
 if (staffMembershipsElsewhere && active && supportSessionId == null) {
 startSession.mutate({
 organization_id: active.organization_id,
 permission_preview: permissionPreview,
 });
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [staffMembershipsElsewhere, active?.organization_id, permissionPreview]);

 const supportView: SupportViewState = useMemo(
 () => ({
 active: staffMembershipsElsewhere,
 organizationId: active?.organization_id ?? null,
 organizationName: active?.name ?? null,
 mode: "read_only",
 readOnly: staffMembershipsElsewhere,
 permissionPreview,
 sessionId: supportSessionId,
 }),
 [staffMembershipsElsewhere, active, permissionPreview, supportSessionId],
 );

 const effectiveRole = staffMembershipsElsewhere
 ? permissionPreview
 : active?.role ?? "client_viewer";
 const canManage =
 effectiveRole === "client_admin" ||
 effectiveRole === "platform_admin" ||
 effectiveRole === "operations";

 if (!active) {
 return (
 <div className="mx-auto max-w-3xl p-8">
 <EmptyState
 title="No client workspace yet"
 description="Your account isn't linked to a client organization, so there's nothing to show here yet."
 whatAppearsHere="Once you're added to a workspace, your roles, shortlists, interviews, and offers appear here."
 action={{ label: "Submit a role", to: "/intake" }}
 >
 <p className="mt-4 text-xs text-muted-foreground">
 Already part of a team? Ask the person who set up your workspace to invite
 your email address.
 </p>
 </EmptyState>
 </div>
 );
 }

 const deniedTab = MANAGE_ONLY_PATHS.find(
 (path) => pathname === path || pathname.startsWith(path + "/"),
 );
 const permissionDenied = !canManage && !!deniedTab;

 const navItems: WorkspaceNavItem[] = TABS.filter((t) => t.everyone || canManage).map(
 ({ everyone: _e, ...rest }) => rest,
 );
 const linkSearch = supportView.active
 ? { org: active.organization_id, preview: permissionPreview }
 : undefined;

 const topBanner = (
 <>
 <SupportViewBanner />
 {supportView.active && (
 <div className="border-b bg-muted/40 px-4 py-1.5 text-xs">
 <div className="mx-auto flex max-w-6xl items-center gap-3">
 <span className="text-muted-foreground">Preview permission level:</span>
 {(
 ["client_admin", "client_editor", "client_viewer"] as PermissionPreview[]
 ).map((p) => (
 <Link
 key={p}
 to="/client"
 search={{ org: active.organization_id, preview: p }}
 className={`rounded px-2 py-0.5 capitalize ${
 permissionPreview === p
 ? "bg-primary text-primary-foreground"
 : "hover:bg-muted"
 }`}
 >
 {p.replace("client_", "")}
 </Link>
 ))}
 </div>
 </div>
 )}
 </>
 );

 const showOnboarding =
 !supportView.active &&
 !!data?.active &&
 (data.onboarding?.dismissed_at ?? null) === null;

 return (
 <SupportViewContext.Provider value={supportView}>
 <ClientCoordinator />
   <WorkspaceShell
 role="client"
 contextKicker="Workspace"
 contextLabel={active.name}
 contextSubLabel={`${effectiveRole.replace(/_/g, " ")}${supportView.active ? " · support view" : ""}`}
 navItems={navItems}
 linkSearch={linkSearch}
 topBanner={topBanner}
 primaryAction={
   canManage && !supportView.readOnly
     ? { label: "Create role", shortLabel: "New role", to: "/intake", icon: Plus }
     : undefined
 }
 aboveNav={
 data && data.organizations.length > 1 ? (
 <OrgSwitcher
 activeOrgId={active.organization_id}
 organizations={data.organizations}
 />
 ) : undefined
 }
 >
      <div className="mb-4">
        <ClientBrandHeader
          name={active.name}
          displayName={active.brand_display_name ?? null}
          logoUrl={active.logo_url ?? null}
          primaryColor={active.brand_primary_color ?? null}
          accentColor={active.brand_accent_color ?? null}
          parentName={active.parent_name ?? null}
          role={effectiveRole}
          supportView={supportView.active}
        />
      </div>
      {permissionDenied ? (
        <PermissionDenied
          description={`${MANAGE_ONLY_LABELS[deniedTab!] ?? "This area"} is limited to workspace admins, so we're not showing it to you.`}
          whoToAsk={`Ask an admin in ${active.name} to upgrade your access, or ask them to make the change for you.`}
          action={{ label: "Back to overview", to: "/client" }}
        />
      ) : (
        <>
          <SectionTabs groups={CLIENT_SECTION_GROUPS} linkSearch={linkSearch} />
          <Outlet />
        </>

      )}
 {showOnboarding && (
 <ClientOnboardingModal
 orgId={active.organization_id}
 orgName={active.name}
 role={effectiveRole as "client_admin" | "client_editor" | "client_viewer"}
 initialTimezone={data?.onboarding?.timezone ?? null}
 displayName={data?.onboarding?.display_name ?? null}
 />
 )}
 </WorkspaceShell>
 </SupportViewContext.Provider>
 );
}

const CLIENT_REFRESH_KEYS = [
  ACTIVITY_QUERY_KEY,
  AGENT_RAIL_QUERY_KEY,
  SYSTEM_HEALTH_QUERY_KEY,
  ["client-context"],
  ["client", "kpis"],
  ["client", "positions"],
  ["client", "candidates"],
  ["client", "messages"],
  NOTIFICATIONS_QUERY_KEY,
] as const;


function ClientCoordinator() {
 const [userId, setUserId] = useState<string | null>(null);
 useEffect(() => {
 supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
 }, []);
 useDashboardRealtime({ userId, audience: "client", invalidateKeys: CLIENT_REFRESH_KEYS });
 return null;
}

