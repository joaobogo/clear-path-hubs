import {
  makeRouteErrorComponent,
  makeRouteNotFoundComponent,
} from "@/components/workspace/route-states";
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
  Bell,
  ClipboardCheck,
  Database,
  HeartPulse,
  Scale,
  ShieldCheck,
  UserCog,
  Receipt,
  Timer,
  LifeBuoy,
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
  errorComponent: makeRouteErrorComponent("admin", "/_authenticated/admin"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
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
  {
    to: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
    group: "Command",
    hint: "Urgent queue and workload",
  },

  { to: "/admin/intake", label: "Intake", icon: Inbox, group: "Delivery", hint: "New client requests" },
  { to: "/admin/clients", label: "Clients", icon: Building2, group: "Delivery", hint: "Organizations and seats" },
  { to: "/admin/positions", label: "Positions", icon: Briefcase, group: "Delivery", hint: "Requisitions and jobs" },
  { to: "/admin/candidates", label: "Candidates", icon: Users, group: "Delivery", hint: "Applications and screening" },
  { to: "/admin/publish", label: "Publish Desk", icon: Send, group: "Delivery", hint: "Release candidates to clients" },

  {
    to: "/admin/scoring/review",
    label: "Scoring Review",
    icon: ClipboardCheck,
    group: "Quality",
    hint: "Evidence QC and approval decisions",
  },
  {
    to: "/admin/scoring/orphans",
    label: "Scoring Orphans",
    icon: ClipboardCheck,
    group: "Quality",
    hint: "Unmatched and unresolved score runs",
  },
  { to: "/admin/business-rules", label: "Business Rules", icon: Scale, group: "Quality", hint: "Thresholds and overrides" },
  { to: "/admin/qa-report", label: "QA Report", icon: ShieldCheck, group: "Quality", hint: "Release checks" },

  { to: "/admin/messages", label: "Messages", icon: MessageSquare, group: "Comms" },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, group: "Comms" },
  { to: "/admin/copilot", label: "Copilot", icon: Bot, group: "Comms", hint: "Admin AI assistant" },

  { to: "/admin/wbr", label: "Weekly Review", icon: CalendarRange, group: "Insight" },
  { to: "/admin/operations", label: "Operations", icon: Activity, group: "Insight", hint: "Pipeline and job health" },
  { to: "/admin/health", label: "System Health", icon: HeartPulse, group: "Insight" },
  { to: "/admin/data-health", label: "Data Health", icon: Database, group: "Insight", hint: "Coverage, duplicates, orphans" },
  { to: "/admin/sla", label: "SLA Clock", icon: Timer, group: "Insight", hint: "Promises approaching or missed" },
  { to: "/admin/support", label: "Support View", icon: LifeBuoy, group: "Platform", hint: "Read-only client workspace" },

  { to: "/admin/payments", label: "Payments", icon: Receipt, group: "Platform", hint: "Read-only payment ledger" },
  {
    to: "/admin/pending-leads",
    label: "Pending Leads",
    icon: Receipt,
    group: "Platform",
    hint: "Calls booked and roles awaiting payment",
  },
  {
    to: "/admin/dashboard-requests",
    label: "Dashboards Desk",
    icon: Gauge,
    group: "Platform",
    hint: "Custom dashboard quotes and access grants",
  },
  { to: "/admin/team", label: "Team & Access", icon: UserCog, group: "Platform" },
  { to: "/admin/settings", label: "Settings", icon: Settings, group: "Platform" },
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


