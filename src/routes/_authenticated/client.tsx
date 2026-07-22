import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getClientContext } from "@/lib/client.functions";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell, NOTIFICATIONS_QUERY_KEY } from "@/components/notification-bell";
import { SignOutButton } from "@/components/sign-out-button";
import { useDashboardRealtime } from "@/hooks/use-realtime-refresh";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  MessageSquare,
  UserCog,
  Settings,
} from "lucide-react";

const searchSchema = z.object({ org: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/client")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Client workspace · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ context }) => {
    const ctx = await context.queryClient.ensureQueryData({
      queryKey: ["client-context", null],
      queryFn: () => getClientContext({ data: {} }),
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

const TABS: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; everyone: boolean }[] = [
  { to: "/client", label: "Overview", icon: LayoutDashboard, exact: true, everyone: true },
  { to: "/client/positions", label: "Positions", icon: Briefcase, everyone: true },
  { to: "/client/candidates", label: "Candidates", icon: Users, everyone: true },
  { to: "/client/messages", label: "Messages", icon: MessageSquare, everyone: true },
  { to: "/client/team", label: "Team", icon: UserCog, everyone: false },
  { to: "/client/settings", label: "Settings", icon: Settings, everyone: false },
];

function ClientLayout() {
  const ctx = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const getCtx = useServerFn(getClientContext);
  const { data } = useQuery({
    queryKey: ["client-context", null],
    queryFn: () => getCtx({ data: {} }),
    initialData: ctx,
  });

  // Realtime: any change to visible candidate_matches invalidates queries.
  useEffect(() => {
    if (!data?.active) return;
    const orgId = data.active.organization_id;
    const channel = supabase
      .channel(`client-workspace-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "candidate_matches",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).dispatchEvent(new CustomEvent("client:refresh"));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.active]);

  const active = data?.active;
  const canManage =
    active?.role === "client_admin" ||
    active?.role === "platform_admin" ||
    active?.role === "operations";

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

  return (
    <div className="min-h-screen flex w-full bg-background">
      <ClientCoordinator />
      <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
        <div className="px-4 py-4 border-b flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</div>
            <div className="font-semibold truncate">{active.name}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {active.role.replace(/_/g, " ")}
            </div>
          </div>
          <NotificationBell />
        </div>
        <nav className="p-2 space-y-1">
          {TABS.filter((t) => t.everyone || canManage).map((t) => {
            const activeTab = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                  activeTab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-3 border-t">
          <SignOutButton className="w-full inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" />
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

const CLIENT_REFRESH_KEYS = [
  ["client-context", null],
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
