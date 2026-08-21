import {
  createFileRoute,
  Link,
  Outlet,
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
import { getActiveSupportSession } from "@/lib/support-audit.functions";
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
 Building2,
 	Gauge,
  BarChart3,
  Dna,
  Plus,
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
  head: () => ({
    meta: [
      { title: "Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  // The client layout intentionally has no loader. The workspace shell renders
  // immediately with a stable placeholder; the active org and permission set
  // are resolved in the component via React Query. Child routes are responsible
  // for their own data, so a slow overview or role detail never blocks the shell
  // or any other page from becoming readable.
  component: ClientLayout,
});

type NavDef = WorkspaceNavItem & { everyone: boolean };

// Four primary destinations (Overview, Roles, Candidates, Messages, Account)
// carry the whole client job; everything else is demoted into "More" or into
// tabs inside those pages (see CLIENT_SECTION_GROUPS). Nothing was deleted and
// no URL changed — demotion only, so every bookmark still resolves.
const TABS: NavDef[] = [
  {
    to: "/client",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
    everyone: true,
    hint: "What needs you today",
  },
  {
    to: "/client/positions",
    label: "Roles",
    icon: Briefcase,
    everyone: true,
    hint: "Roles, interviews, offers",
  },
  {
    to: "/client/candidates",
    label: "Candidates",
    icon: Users,
    everyone: true,
    hint: "Shortlist, talent memory",
  },

  {
    to: "/client/conversations",
    label: "Messages",
    icon: MessageSquare,
    everyone: true,
    hint: "Threads, inbox, all messages",
  },
  {
    to: "/client/intelligence",
    label: "Insights",
    icon: BarChart3,
    everyone: true,
    hint: "Hiring intelligence, executive, portfolio",
  },
  {
    to: "/client/account",
    label: "Account",
    icon: Building2,
    everyone: false,
    hint: "Team, plan, settings",
  },
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
    staleTime: 5 * 60 * 1000,
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

  // Read-only lookup only. Opening a client workspace never creates a support
  // session — sessions come exclusively from the explicit form on /admin/support
  // with its reason. If no session exists the surface is still labelled
  // read-only, it just has no session reference to show.
 	const activeSupportSession = useQuery({
 		queryKey: ["active-support-session", active?.organization_id ?? null],
 		queryFn: () =>
 			getActiveSupportSession({
 				data: { organization_id: active!.organization_id },
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
    // While the workspace context is still resolving, show the shell immediately
    // with a placeholder so the page never feels frozen. Child routes render in
    // parallel and fetch their own data, so a slow overview never blocks the
    // entire workspace.
    if (ctxIsFetching && data === undefined) {
      return (
        <WorkspaceShell
          role="client"
          contextKicker="Workspace"
          contextLabel="Loading workspace…"
          contextSubLabel="Resolving your account"
          accountLabel="My account"
          navItems={TABS.filter((t) => t.everyone).map(({ everyone: _e, ...rest }) => rest)}
        >
          <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
            <div className="space-y-6">
              <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-40 w-full animate-pulse rounded bg-muted" />
              <div className="h-40 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        </WorkspaceShell>
      );
    }

    // M7: the staff / unlinked-account shell keeps the app header and navigation,
    // so the only way out isn't the browser Back button.
    return (
      <WorkspaceShell
        role="client"
        contextKicker="Workspace"
        contextLabel="No workspace"
        contextSubLabel={data?.isStaff ? "platform staff" : "not linked yet"}
        accountLabel={data?.onboarding?.display_name?.trim() || "My account"}
        navItems={
          data?.isStaff
            ? [{ to: "/admin/clients", label: "Clients", icon: Building2 } as WorkspaceNavItem]
            : []
        }
      >
        <div className="mx-auto max-w-3xl p-8">
          <EmptyState
            title="No client workspace yet"
            description={
              data?.isStaff
                ? "Your staff account isn't a member of a client organization. Open a client from the admin client list to view their workspace."
                : "Your account isn't linked to a client organization, so there's nothing to show here yet."
            }
            whatAppearsHere="Once you're added to a workspace, your roles, shortlists, interviews, and offers appear here."
            action={
              data?.isStaff
                ? { label: "Go to clients", to: "/admin/clients" }
                : { label: "Submit a role", to: "/intake" }
            }
          >
            <p className="mt-4 text-xs text-muted-foreground">
              Already part of a team? Ask the person who set up your workspace to invite
              your email address.
            </p>
          </EmptyState>
        </div>
      </WorkspaceShell>
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
            to={pathname}
            search={{ ...search, preview: p }}
            replace
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
      ? { label: "Create role", shortLabel: "New role", to: "/client/positions/new", icon: Plus }
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

