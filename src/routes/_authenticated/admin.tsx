import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Building2,
  Users,
  Send,
  Activity,
  Settings,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/notification-bell";
import { useDashboardRealtime } from "@/hooks/use-realtime-refresh";
import { NOTIFICATIONS_QUERY_KEY } from "@/components/notification-bell";

export const Route = createFileRoute("/_authenticated/admin")({
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
  { to: "/admin/clients", label: "Clients & Positions", icon: Building2 },
  { to: "/admin/candidates", label: "Candidates", icon: Users },
  { to: "/admin/publish", label: "Publish Desk", icon: Send },
  { to: "/admin/health", label: "Pipeline Health", icon: Activity },
  { to: "/admin/notifications", label: "Delivery health", icon: Inbox },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

// Query keys to invalidate on ANY admin-relevant notification arrival.
const ADMIN_REFRESH_KEYS = [
  ["admin", "overview"],
  ["admin", "intakes"],
  ["admin", "matches"],
  ["admin", "positions"],
  ["admin", "delivery-failures"],
  NOTIFICATIONS_QUERY_KEY,
] as const;

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-56 shrink-0 border-r bg-card">
        <div className="px-4 py-4 border-b">
          <Link to="/" className="font-semibold text-sm">
            TaaSFlow admin
          </Link>
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
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
