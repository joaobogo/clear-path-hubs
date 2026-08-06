import {
  Activity,
  Briefcase,
  Building2,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  UserCog,
  Users,
} from "lucide-react";

import type { WorkspaceNavItem } from "@/components/workspace/workspace-shell";

/**
 * Admin sidebar: ten primary entries, one per section group.
 *
 * Every sibling desk that used to own a sidebar row is now a tab inside one of
 * these sections (see src/config/workspace-sections.ts), so the sidebar group
 * and the tab strip always tell the same story. Nothing was deleted, so
 * bookmarks and notification deep links keep working.
 */
export const ADMIN_NAV: WorkspaceNavItem[] = [
  {
    to: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
    group: "Command",
    hint: "Urgent queue, workload and your day",
  },

  { to: "/admin/intake", label: "Intake", icon: Inbox, group: "Delivery", hint: "New client requests" },
  { to: "/admin/clients", label: "Clients", icon: Building2, group: "Delivery", hint: "Organizations and seats" },
  { to: "/admin/positions", label: "Positions", icon: Briefcase, group: "Delivery", hint: "Requisitions and jobs" },
  {
    to: "/admin/candidates",
    label: "Candidates",
    icon: Users,
    group: "Delivery",
    hint: "Applications, screening, publishing and approvals",
  },

  {
    to: "/admin/scoring/review",
    label: "Quality",
    icon: ClipboardCheck,
    group: "Quality",
    hint: "Scoring review, unreadable docs, missing evidence, answers we owe",
  },

  {
    to: "/admin/messages",
    label: "Comms",
    icon: MessageSquare,
    group: "Comms",
    hint: "Messages, notifications, copilot",
  },

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

  {
    to: "/admin/team",
    label: "Team & Access",
    icon: UserCog,
    group: "Access",
    hint: "Staff access and settings",
  },
];
