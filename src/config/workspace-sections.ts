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
      
    ],
  },
  {
    id: "candidates",
    label: "Candidates",
    tabs: [
      { to: "/client/candidates", label: "Shortlist" },
      // Same route, same query — the board is a view, told apart by search.
      { to: "/client/candidates", label: "Board", search: { view: "board" } },
      { to: "/client/talent-pool", label: "Talent pool" },
    ],
  },
  {
    id: "messages",
    label: "Messages",
    // One thread list. The old Inbox / All messages views are filter chips on
    // the list itself, so there is no second tab row here.
    tabs: [{ to: "/client/conversations", label: "Messages" }],
  },

  {
    id: "account",
    label: "Account",
    // ONE tab row for the account area: these are the account page's own
    // panels, addressed by `?tab=`. The old /client/team, /client/plan and
    // /client/settings URLs still redirect here, so bookmarks keep working.
    tabs: [
      { to: "/client/account", label: "Workspace" },
      { to: "/client/account", label: "Team & roles", search: { tab: "team" } },
      { to: "/client/account", label: "Plan & billing", search: { tab: "plan" } },
      { to: "/client/account", label: "Notifications", search: { tab: "notifications" } },
      // { to: "/client/account", label: "Branding", search: { tab: "branding" } },
      { to: "/client/onboarding", label: "Setup" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    tabs: [
      { to: "/client/executive", label: "Executive" },
      { to: "/client/portfolio", label: "Portfolio" },
    ],
  },
];

export const ADMIN_SECTION_GROUPS: SectionGroup[] = [
  {
    id: "command",
    label: "Command",
    tabs: [
      { to: "/admin", label: "Overview", exact: true },

    ],
  },
  {
    id: "delivery",
    label: "Delivery",
    tabs: [
      { to: "/admin/intake", label: "Intake" },
      { to: "/admin/clients", label: "Clients" },
      { to: "/admin/positions", label: "Positions" },
      { to: "/admin/candidates", label: "Candidates" },
      { to: "/admin/publish", label: "Publish desk" },
      // Approvals themselves live on the Overview work queue now; this desk is
      // the decisions we are still waiting on from clients.
      { to: "/admin/decision-backlog", label: "Decision backlog" },
    ],
  },
  {
    id: "quality",
    label: "Quality",
    tabs: [
      { to: "/admin/scoring/review", label: "Scoring review" },
      { to: "/admin/scoring/calibration", label: "Calibration desk", requiresPlatformAdmin: true },

      { to: "/admin/parse-failures", label: "Unreadable docs" },
      { to: "/admin/evidence-gaps", label: "Missing evidence" },
      { to: "/admin/outcome-sla", label: "Answers we owe" },
      { to: "/admin/intake-quality", label: "Intake quality" },
      { to: "/admin/qa-report", label: "QA report" },

    ],
  },

  {
    id: "comms",
    label: "Comms",
    tabs: [
      { to: "/admin/messages", label: "Messages" },
      { to: "/admin/notifications", label: "Notifications" },
    ],
  },
  {
    id: "insight",
    label: "Operations",
    tabs: [
      { to: "/admin/operations", label: "Operations" },
      { to: "/admin/agent-ops", label: "Agent operations", requiresPlatformAdmin: true },
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
      { to: "/admin/team", label: "Team & access", requiresPlatformAdmin: true },
      { to: "/admin/settings", label: "Settings", requiresPlatformAdmin: true },
    ],
  },
];
