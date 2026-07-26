import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ACTIVITY_QUERY_KEY } from "@/components/activity/ActivityFeed";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  Users,
  Send,
  Activity,
  MessageSquare,
  Settings,
  Inbox,
  CalendarRange,
  Bot,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { NOTIFICATIONS_QUERY_KEY } from "@/components/notification-bell";
import { useDashboardRealtime } from "@/hooks/use-realtime-refresh";
import { getSessionContext } from "@/lib/auth.functions";
import {
  WorkspaceShell,
  type WorkspaceNavItem,
} from "@/components/workspace/workspace-shell";

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

const NAV: WorkspaceNavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/intake", label: "Intake", icon: Inbox },
  { to: "/admin/clients", label: "Clients", icon: Building2 },
  { to: "/admin/positions", label: "Positions", icon: Briefcase },
  { to: "/admin/candidates", label: "Candidates", icon: Users },
  { to: "/admin/publish", label: "Publish Desk", icon: Send },
  { to: "/admin/operations", label: "Operations", icon: Activity },
  { to: "/admin/wbr", label: "Weekly Review", icon: CalendarRange },
  { to: "/admin/copilot", label: "Copilot", icon: Bot },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];


const ADMIN_REFRESH_KEYS = [
  ACTIVITY_QUERY_KEY,
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
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
    });
  }, []);
  useDashboardRealtime({ userId, audience: "admin", invalidateKeys: ADMIN_REFRESH_KEYS });

  return (
    <WorkspaceShell
      role="admin"
      contextKicker="TaaSFlow"
      contextLabel="Admin"
      contextSubLabel={email ?? undefined}
      navItems={NAV}
      searchScope="admin"
    >
      <Outlet />
    </WorkspaceShell>
  );
}


