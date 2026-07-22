import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Users,
  Send,
  Activity,
  MessageSquare,
  Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/notification-bell";
import { SignOutButton } from "@/components/sign-out-button";
import { useDashboardRealtime } from "@/hooks/use-realtime-refresh";
import { NOTIFICATIONS_QUERY_KEY } from "@/components/notification-bell";
import { getSessionContext } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    try {
      const ctx = await getSessionContext();
      const staff = ctx.memberships.some(
        (m) => m.status === "active" && (m.role === "platform_admin" || m.role === "operations"),
      );
      if (!staff) throw redirect({ to: "/access-denied" });
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (e && typeof e === "object" && (e as any).isRedirect) throw e;
      throw redirect({ to: "/access-denied" });
    }
  },
  head: () => ({
    meta: [
      { title: "Admin · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const SECTIONS: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/clients", label: "Clients", icon: Building2 },
  { to: "/admin/positions", label: "Positions", icon: Briefcase },
  { to: "/admin/candidates", label: "Candidates", icon: Users },
  { to: "/admin/publish", label: "Publish Desk", icon: Send },
  { to: "/admin/operations", label: "Operations", icon: Activity },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const ADMIN_REFRESH_KEYS = [
  ["admin-overview"],
  ["admin", "intakes"],
  ["admin", "matches"],
  ["admin", "positions"],
  ["admin", "delivery-failures"],
  ["pipeline-health"],
  ["publish-queue"],
  ["admin-messages"],
  NOTIFICATIONS_QUERY_KEY,
] as const;


function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
  useDashboardRealtime({ userId, audience: "admin", invalidateKeys: ADMIN_REFRESH_KEYS });

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
        <div className="px-4 py-4 border-b flex items-center justify-between gap-2">
          <Link to="/" className="font-semibold text-sm">TaaSFlow admin</Link>
          <NotificationBell />
        </div>
        <nav className="p-2 space-y-1">
          {SECTIONS.map((s) => {
            const active = s.exact ? pathname === s.to : pathname.startsWith(s.to);
            return (
              <Link
                key={s.to}
                to={s.to}
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
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

