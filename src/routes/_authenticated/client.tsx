import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";
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
  // CalendarClock removed from nav; icon no longer needed here.
  UserCog,
  Settings,
} from "lucide-react";
import {
  WorkspaceShell,
  type WorkspaceNavItem,
} from "@/components/workspace/workspace-shell";
import { OrgSwitcher } from "@/components/workspace/org-switcher";

const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);
const searchSchema = z.object({
  org: z.preprocess(emptyToUndef, z.string().uuid().optional()),
  preview: z.preprocess(
    emptyToUndef,
    z.enum(["client_admin", "client_editor", "client_viewer"]).optional(),
  ),
});

export const Route = createFileRoute("/_authenticated/client")({
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
    if (!ctx.active && ctx.organizations.length === 0 && !ctx.isStaff) {
      throw redirect({ to: "/" });
    }
    return ctx;
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Failed to load workspace: {error.message}</div>
  ),
  component: ClientLayout,
});

type NavDef = WorkspaceNavItem & { everyone: boolean };

const TABS: NavDef[] = [
  { to: "/client", label: "Overview", icon: LayoutDashboard, exact: true, everyone: true },
  { to: "/client/positions", label: "Positions", icon: Briefcase, everyone: true },
  { to: "/client/candidates", label: "Candidates", icon: Users, everyone: true },
  // Interviews merged into Positions / Candidates record pages — route stays reachable via deep links.
  { to: "/client/messages", label: "Messages", icon: MessageSquare, everyone: true },
  { to: "/client/team", label: "Team", icon: UserCog, everyone: false },
  { to: "/client/settings", label: "Settings", icon: Settings, everyone: false },
];

function ClientLayout() {
  const ctx = Route.useLoaderData();
  const search = Route.useSearch();
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
        <h1 className="text-2xl font-semibold mb-2">No client workspace yet</h1>
        <p className="text-muted-foreground">
          Your account isn&apos;t linked to a client organization. Ask your admin to invite
          you, or{" "}
          <Link to="/intake" className="text-primary underline">
            submit a new intake
          </Link>{" "}
          to create one.
        </p>
      </div>
    );
  }

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
        contextKicker="Workspace"
        contextLabel={active.name}
        contextSubLabel={`${effectiveRole.replace(/_/g, " ")}${supportView.active ? " · support view" : ""}`}
        navItems={navItems}
        linkSearch={linkSearch}
        topBanner={topBanner}
        aboveNav={
          data && data.organizations.length > 1 ? (
            <OrgSwitcher
              activeOrgId={active.organization_id}
              organizations={data.organizations}
            />
          ) : undefined
        }
      >
        <Outlet />
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

