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
import { getClientContext } from "@/lib/client-context.functions";
import { ensureSupportSession } from "@/lib/support-audit.functions";
import { supabase } from "@/integrations/supabase/client";
import { NOTIFICATIONS_QUERY_KEY } from "@/components/notification-bell";
import { useDashboardRealtime } from "@/hooks/use-realtime-refresh";
import { SupportViewBanner } from "@/components/support-view-banner";
import { DegradedModeBanner } from "@/components/client/degraded-mode-banner";

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
import { SectionTabs } from "@/components/workspace/section-tabs";
import { CLIENT_SECTION_GROUPS } from "@/config/workspace-sections";
import { OrgSwitcher } from "@/components/workspace/org-switcher";
import { EmptyState, PermissionDenied } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";

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

// Part 9 subtraction, then hierarchy: four primary entries carry the decision
// job (see what needs you, work a role, judge a candidate, approve). Everything
// else is a subordinate "More" group. URLs are unchanged — this is hierarchy
// only, so nothing became unreachable.
const TABS: NavDef[] = [
	{ to: "/client", label: "Overview", icon: LayoutDashboard, exact: true, everyone: true, hint: "What needs you today" },
	{ to: "/client/positions", label: "Roles", icon: Briefcase, everyone: true, hint: "Roles, interviews, offers" },
	{ to: "/client/candidates", label: "Candidates", icon: Users, everyone: true, hint: "Shortlist, talent pool, shared links" },
	{ to: "/client/approvals", label: "Approvals", icon: CheckSquare, everyone: true, hint: "Decisions waiting on you" },
	{ to: "/client/conversations", label: "Messages", icon: MessageSquare, everyone: true, group: "More", subdued: true, hint: "One thread per role and candidate" },
	{ to: "/client/intelligence", label: "Insights", icon: Gauge, everyone: true, group: "More", subdued: true, hint: "Questions, dashboards, your data" },
	{ to: "/client/assistant", label: "Assistant", icon: Bot, everyone: true, group: "More", subdued: true, hint: "Assistant, agents, outreach" },
	{ to: "/client/talent-memory", label: "Talent memory", icon: Award, everyone: true, group: "More", subdued: true, hint: "People we already know" },
	{ to: "/client/onboarding", label: "Setup", icon: Settings, everyone: false, group: "More", subdued: true, hint: "Configure your hiring system" },
	{ to: "/client/account", label: "Account", icon: Building2, everyone: false, group: "More", subdued: true, hint: "Team, plan, settings" },
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
 const {
 data,
 isError: ctxIsError,
 error: ctxError,
 isFetching: ctxIsFetching,
 refetch: refetchCtx,
 } = useQuery({
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

 const permissionPreview: PermissionPreview =
 (search.preview as PermissionPreview | undefined) ?? "client_admin";

  // Staff access to a client workspace is allowed on arrival — opening it from
  // the admin client list is the sanctioned path. Access is recorded, not
  // gated: this opens (or reuses) a read-only support session for the audit
  // trail and never blocks the view if recording fails.
 	const activeSupportSession = useQuery({
 		queryKey: ["active-support-session", active?.organization_id ?? null],
 		queryFn: () =>
 			ensureSupportSession({
 				data: {
 					organization_id: active!.organization_id,
 					permission_preview: permissionPreview,
 				},
 			}),
 		enabled: staffMembershipsElsewhere && !!active?.organization_id,
 		refetchInterval: 60_000,
 	});
 	const supportSession = activeSupportSession.data?.session ?? null;
 	const supportSessionId = supportSession?.id ?? null;
 	const supportSessionRef =
 		((supportSession as { trace_id?: string | null } | null)?.trace_id ?? null) ||
 		(supportSessionId ? supportSessionId.slice(0, 8) : null);
 	const supportSessionExpiresAt =
 		(supportSession as { expires_at?: string | null } | null)?.expires_at ?? null;


 const supportView: SupportViewState = useMemo(
 () => ({
 active: staffMembershipsElsewhere,
 organizationId: active?.organization_id ?? null,
 organizationName: active?.name ?? null,
 mode: "read_only",
 readOnly: staffMembershipsElsewhere,
 permissionPreview,
 sessionId: supportSessionId,
 sessionRef: supportSessionRef,
 sessionExpiresAt: supportSessionExpiresAt,
 }),
 [
 staffMembershipsElsewhere,
 active,
 permissionPreview,
 supportSessionId,
 supportSessionRef,
 supportSessionExpiresAt,
 ],
 );

 const effectiveRole = staffMembershipsElsewhere
 ? permissionPreview
 : active?.role ?? "client_viewer";
 const canManage =
 effectiveRole === "client_admin" ||
 effectiveRole === "platform_admin" ||
 effectiveRole === "operations";

 if (ctxIsError) {
 return (
 <div className="mx-auto max-w-3xl p-8">
 <QueryErrorCard
 title="We couldn't load your workspace"
 error={ctxError}
 onRetry={() => refetchCtx()}
 retrying={ctxIsFetching}
 />
 </div>
 );
 }

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
  accountLabel={data?.onboarding?.display_name?.trim() || "My account"}
  accountSubLabel={`${effectiveRole.replace(/_/g, " ")}${supportView.active ? " · support view" : ""}`}
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
      {/* The sidebar is the single primary identity: no workspace card here. */}
      {permissionDenied ? (
        <PermissionDenied
          description={`${MANAGE_ONLY_LABELS[deniedTab!] ?? "This area"} is limited to workspace admins, so we're not showing it to you.`}
          whoToAsk={`Ask an admin in ${active.name} to upgrade your access, or ask them to make the change for you.`}
          action={{ label: "Back to overview", to: "/client" }}
        />
      ) : (
        // data-client-workspace scopes the phone ergonomics in
        // styles/client-mobile.css: 44px targets, 14px floor, no side scroll.
        <div data-client-workspace className="min-w-0">
          <SectionTabs groups={CLIENT_SECTION_GROUPS} linkSearch={linkSearch} />
          {/* Tells the user whether to wait or to act when something measured is off. */}
          <DegradedModeBanner className="mt-4" />
          <Outlet />
        </div>
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

