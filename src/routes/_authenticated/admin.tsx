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
  Gauge,
  HeartPulse,
  Scale,
  ShieldCheck,
  UserCog,
  Receipt,
  Timer,
  LifeBuoy,
  FileWarning,
  SearchX,
  AlarmClock,

} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { NOTIFICATIONS_QUERY_KEY } from "@/components/notification-bell";
import { useDashboardRealtime } from "@/hooks/use-realtime-refresh";
import { getSessionContext } from "@/lib/auth.functions";
import { ExceptionDigest } from "@/components/admin/exception-digest";
import { TestRecordsToggle } from "@/components/admin/test-records-toggle";
import { SectionTabs } from "@/components/workspace/section-tabs";
import { ADMIN_SECTION_GROUPS } from "@/config/workspace-sections";
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

// Part 9 subtraction: eleven entries instead of twenty-five. Sibling desks are
// tabs inside these sections (see src/config/workspace-sections.ts).
const NAV: WorkspaceNavItem[] = [
  {
    to: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
    group: "Command",
    hint: "Urgent queue and workload",
  },
  {
    to: "/admin/my-day",
    label: "My day",
    icon: AlarmClock,
    group: "Command",
    hint: "The roles you own that need action today",
  },

  { to: "/admin/intake", label: "Intake", icon: Inbox, group: "Delivery", hint: "New client requests" },
  { to: "/admin/clients", label: "Clients", icon: Building2, group: "Delivery", hint: "Organizations and seats" },
  { to: "/admin/positions", label: "Positions", icon: Briefcase, group: "Delivery", hint: "Requisitions and jobs" },
  { to: "/admin/candidates", label: "Candidates", icon: Users, group: "Delivery", hint: "Applications and screening" },
  { to: "/admin/publish", label: "Publish Desk", icon: Send, group: "Delivery", hint: "Release candidates to clients" },
  {
    to: "/admin/approvals",
    label: "Approvals",
    icon: ShieldCheck,
    group: "Delivery",
    hint: "Pending client-visible actions",
  },

  {
    to: "/admin/scoring/review",
    label: "Quality",
    icon: ClipboardCheck,
    group: "Quality",
    hint: "Scoring review, orphans, business rules, QA",
  },

  {
    to: "/admin/parse-failures",
    label: "Unreadable docs",
    icon: FileWarning,
    group: "Quality",
    hint: "Documents we could not read, with named next actions",
  },

  {
    to: "/admin/evidence-gaps",
    label: "Missing evidence",
    icon: SearchX,
    group: "Quality",
    hint: "Why candidates arrived without evidence, and what they were told",
  },


  { to: "/admin/messages", label: "Comms", icon: MessageSquare, group: "Comms", hint: "Messages, notifications, copilot" },

  {
    to: "/admin/operations",
    label: "Operations",
    icon: Activity,
    group: "Insight",
    hint: "Pipeline health, SLA clock, weekly review, system and data health",
  },

  {
    to: "/admin/payments",
    label: "Platform",
    icon: Receipt,
    group: "Platform",
    hint: "Payments, pending leads, dashboard requests, support view",
  },
  { to: "/admin/team", label: "Team & Access", icon: UserCog, group: "Platform", hint: "Staff access and settings" },
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
      headerSlot={
        <div className="flex items-center gap-2">
          <TestRecordsToggle />
          <ExceptionDigest />
        </div>
      }
    >
      <SectionTabs groups={ADMIN_SECTION_GROUPS} />
      <Outlet />

    </WorkspaceShell>
  );
}


