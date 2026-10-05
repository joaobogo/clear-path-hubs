/**
 * Public integrations directory — client-connectable surfaces only.
 *
 * Internal vendors (CRM mirror, payment webhooks, analytics, transactional
 * email, hosting) belong in the Trust/Privacy provider register, not on a buyer
 * integrations page. Planned logos are not presented as integrations.
 */

export const INTEGRATIONS_LAST_REVIEWED = "5 October 2026";

export type Availability = "available" | "beta" | "custom" | "planned";

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: "Available",
  beta: "Beta",
  custom: "Custom setup",
  planned: "Planned",
};

export type IntegrationCategory =
  | "crm"
  | "calendar"
  | "email"
  | "messaging"
  | "payments"
  | "authentication"
  | "analytics"
  | "webhooks"
  | "api"
  | "agents"
  | "ats"
  | "job-distribution"
  | "data-sources";

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  ats: "Applicant tracking systems",
  crm: "CRM",
  calendar: "Calendar",
  email: "Email",
  messaging: "Messaging",
  payments: "Payments",
  authentication: "Authentication",
  "data-sources": "Data sources",
  "job-distribution": "Job distribution",
  analytics: "Analytics",
  webhooks: "Webhooks",
  api: "API",
  agents: "Agent connectivity (MCP)",
};

export const CATEGORY_ORDER: IntegrationCategory[] = [
  "agents",
  "api",
  "messaging",
  "authentication",
  "ats",
  "calendar",
  "crm",
  "email",
  "webhooks",
  "job-distribution",
  "data-sources",
  "payments",
  "analytics",
];

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  availability: Availability;
  purpose: string;
  connectionMethod: string;
  dataExchanged: string;
  permissions: string;
  healthVisibility: boolean;
  healthNote: string;
  docs: { label: string; to: string; hash?: string } | null;
  plannedNote?: string;
}

/**
 * Every item below is something a client can actually connect or request access
 * to today. Internal operating vendors are intentionally excluded.
 */
export const INTEGRATIONS: Integration[] = [
  {
    id: "mcp",
    name: "Agent connectivity (MCP)",
    category: "agents",
    availability: "available",
    purpose:
      "Connect an external AI assistant such as ChatGPT or Claude to hiring information your own TaaSFlow account is allowed to read.",
    connectionMethod:
      "Model Context Protocol over HTTPS. Sign in with your TaaSFlow account and approve the connection.",
    dataExchanged:
      "Read-only: your hiring roles and requirements, candidates released to your organisation, and screening summaries with supporting evidence.",
    permissions:
      "Your own TaaSFlow sign-in. The connection inherits the same workspace permissions you already have.",
    healthVisibility: false,
    healthNote: "Connection errors are surfaced by the assistant you connect.",
    docs: { label: "Platform overview", to: "/platform" },
  },
  {
    id: "intake-api",
    name: "Employer intake API",
    category: "api",
    availability: "custom",
    purpose:
      "Submit a hiring brief from your own website or internal workflow instead of re-keying it into the public form.",
    connectionMethod:
      "HTTPS JSON integration scoped and documented during onboarding.",
    dataExchanged:
      "Inbound role brief and hiring context; outbound submission reference and processing state.",
    permissions:
      "Access is scoped during onboarding. Public status lookups expose only the associated submission state.",
    healthVisibility: false,
    healthNote: "API failures return an explicit response code and reference.",
    docs: { label: "Ask about API access", to: "/contact" },
  },
  {
    id: "microsoft-teams",
    name: "Microsoft Teams",
    category: "messaging",
    availability: "beta",
    purpose:
      "Post selected hiring notifications into a Teams channel so your team can see movement without opening another tab.",
    connectionMethod:
      "A managed connector is authorised for the team and channel you nominate.",
    dataExchanged:
      "Outbound notifications such as role movement or new activity, with a link back to TaaSFlow.",
    permissions: "Post messages to the channel you authorise.",
    healthVisibility: false,
    healthNote:
      "Beta delivery failures are logged and do not block the underlying hiring workflow.",
    docs: { label: "Ask us to enable Teams", to: "/contact" },
  },
  {
    id: "google-sign-in",
    name: "Google sign-in",
    category: "authentication",
    availability: "available",
    purpose: "Use an existing Google identity to sign in to TaaSFlow.",
    connectionMethod: "OAuth sign-in from the TaaSFlow sign-in flow.",
    dataExchanged:
      "Inbound basic profile and email information used to establish your TaaSFlow identity.",
    permissions: "Basic profile and email only; no mail, calendar, or file access.",
    healthVisibility: false,
    healthNote: "Authentication errors are shown on the sign-in screen.",
    docs: { label: "Sign in", to: "/login" },
  },
];

export function integrationsByCategory(): {
  category: IntegrationCategory;
  label: string;
  items: Integration[];
}[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    items: INTEGRATIONS.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);
}

export const AVAILABILITY_COUNTS = INTEGRATIONS.reduce<Record<Availability, number>>(
  (acc, i) => ({ ...acc, [i.availability]: (acc[i.availability] ?? 0) + 1 }),
  { available: 0, beta: 0, custom: 0, planned: 0 },
);
