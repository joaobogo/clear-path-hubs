import type { SectionGroup } from "@/components/workspace/section-tabs";

/**
 * Part 9 — merge map.
 *
 * Each group is ONE nav entry. Everything inside it used to be its own
 * sidebar item; now they are tabs on one screen. Nothing was deleted, so no
 * bookmark or notification link breaks.
 */

export const CLIENT_SECTION_GROUPS: SectionGroup[] = [
  {
    id: "roles",
    label: "Roles",
    tabs: [
      { to: "/client/positions", label: "Roles" },
      { to: "/client/interviews", label: "Interviews" },
      { to: "/client/offers", label: "Offers" },
      { to: "/client/deliveries", label: "Deliveries" },
    ],
  },
  {
    id: "candidates",
    label: "Candidates",
    tabs: [
      { to: "/client/candidates", label: "Shortlist" },
      { to: "/client/talent-pool", label: "Talent pool" },
      { to: "/client/talent-memory", label: "Talent memory" },
      { to: "/client/shares", label: "Shared links" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    tabs: [
      { to: "/client/intelligence", label: "Hiring Intelligence" },
      { to: "/client/analytics", label: "Questions" },
      { to: "/client/dashboards", label: "Dashboards" },
      { to: "/client/data", label: "Your data" },
      { to: "/client/executive", label: "Executive" },
      { to: "/client/portfolio", label: "Portfolio" },
    ],
  },
  {
    id: "automation",
    label: "Assistant",
    tabs: [
      { to: "/client/assistant", label: "Assistant" },
      { to: "/client/agents", label: "Agents" },
      { to: "/client/outreach", label: "Outreach" },
    ],
  },
  {
    id: "account",
    label: "Account",
    tabs: [
      { to: "/client/account", label: "Account" },
      { to: "/client/team", label: "Team" },
      { to: "/client/plan", label: "Plan & billing" },
      { to: "/client/settings", label: "Settings" },
    ],
  },
];

export const ADMIN_SECTION_GROUPS: SectionGroup[] = [
  {
    id: "quality",
    label: "Quality",
    tabs: [
      { to: "/admin/scoring/review", label: "Scoring review" },
      { to: "/admin/scoring/orphans", label: "Orphans" },
      { to: "/admin/business-rules", label: "Business rules" },
      { to: "/admin/qa-report", label: "QA report" },
    ],
  },
  {
    id: "comms",
    label: "Comms",
    tabs: [
      { to: "/admin/messages", label: "Messages" },
      { to: "/admin/notifications", label: "Notifications" },
      { to: "/admin/copilot", label: "Copilot" },
    ],
  },
  {
    id: "insight",
    label: "Operations",
    tabs: [
      { to: "/admin/operations", label: "Operations" },
      { to: "/admin/agent-ops", label: "Agent operations" },
      { to: "/admin/sla", label: "SLA clock" },
      { to: "/admin/wbr", label: "Weekly review" },
      { to: "/admin/health", label: "System health" },
      { to: "/admin/data-health", label: "Data health" },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    tabs: [
      { to: "/admin/payments", label: "Payments" },
      { to: "/admin/pending-leads", label: "Pending leads" },
      { to: "/admin/lead-delivery", label: "Lead delivery" },
      { to: "/admin/dashboard-requests", label: "Dashboard requests" },
      { to: "/admin/support", label: "Support view" },
      { to: "/admin/seo", label: "Search visibility" },
      { to: "/admin/integrations", label: "Integration health" },
      { to: "/admin/tracking", label: "Consent & tracking" },

    ],
  },
  {
    id: "access",
    label: "Access",
    tabs: [
      { to: "/admin/team", label: "Team & access" },
      { to: "/admin/settings", label: "Settings" },
      { to: "/admin/design-system", label: "Design system" },
    ],
  },
];
