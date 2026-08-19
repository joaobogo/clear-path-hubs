/**
 * Public Integrations directory — verified connections only.
 * ------------------------------------------------------------------
 * Every listing below traces to code in this repository:
 *   - Stripe, Attio, Calendly, transactional email: probed by
 *     `src/lib/integration-health.server.ts` and shown in admin health.
 *   - Microsoft Teams: `src/lib/teams-notify.server.ts`.
 *   - Google sign-in: Supabase Auth social provider used by `/login`.
 *   - Payment webhooks: `src/routes/api/public/payments/webhook.ts`.
 *   - Intake / status endpoints: `src/routes/api/public/*`.
 *   - MCP: `src/lib/mcp/*`, mounted at `/mcp` with OAuth 2.1.
 *   - Website analytics: `src/lib/tracking/pixels.ts` behind the consent gate.
 *
 * Anything not implemented is labelled `planned` and never described as
 * usable today. No credential, environment-variable name, secret endpoint or
 * internal configuration value may appear in this file.
 */

export const INTEGRATIONS_LAST_REVIEWED = "4 August 2026";

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

/** Ordered category rail — only categories with listings are rendered. */
export const CATEGORY_ORDER: IntegrationCategory[] = [
  "agents",
  "api",
  "webhooks",
  "crm",
  "calendar",
  "email",
  "messaging",
  "payments",
  "authentication",
  "analytics",
  "ats",
  "job-distribution",
  "data-sources",
];

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  availability: Availability;
  /** What it is for, in one line a buyer can read without context. */
  purpose: string;
  /** How the connection is established — no endpoints, no secret names. */
  connectionMethod: string;
  /** What data crosses the boundary, in both directions where relevant. */
  dataExchanged: string;
  /** What the connected account must be allowed to do. */
  permissions: string;
  /** True when the connection is probed and reported inside the workspace. */
  healthVisibility: boolean;
  /** Short note explaining the health signal, or its absence. */
  healthNote: string;
  /** Setup documentation — a page on this site, or an honest absence. */
  docs: { label: string; to: string; hash?: string } | null;
  /** Only for `planned` listings: what has to be true before it ships. */
  plannedNote?: string;
}

export const INTEGRATIONS: Integration[] = [
  /* ------------------------------------------------------ agents / api */
  {
    id: "mcp",
    name: "Agent connectivity (MCP)",
    category: "agents",
    availability: "available",
    purpose:
      "Lets an external AI assistant such as Claude or ChatGPT read your roles, shortlists and candidate evidence with your own permissions.",
    connectionMethod:
      "Model Context Protocol over HTTPS. You add the TaaSFlow server in your assistant, sign in with your TaaSFlow account and approve the connection on a consent screen.",
    dataExchanged:
      "Read-only: your hiring roles and their requirements, candidates released to you, and screening summaries with supporting evidence. Nothing is written back.",
    permissions:
      "Your own TaaSFlow sign-in. The connection sees exactly what you see in the workspace — candidates not yet shared with you stay invisible.",
    healthVisibility: false,
    healthNote:
      "No health panel yet. A failed connection surfaces as an error in your assistant.",
    docs: { label: "Platform overview", to: "/platform" },
  },
  {
    id: "intake-api",
    name: "Intake and application endpoints",
    category: "api",
    availability: "custom",
    purpose:
      "Submit a hiring brief or check an application's progress from your own site or internal tooling instead of our forms.",
    connectionMethod:
      "HTTPS JSON requests to documented public endpoints, validated against a strict schema. We agree the payload with you during onboarding.",
    dataExchanged:
      "Inbound: role brief, contact details, hiring context. Outbound: submission reference and current processing state.",
    permissions:
      "Agreed in writing during onboarding. Application status lookups return only the reference holder's own state.",
    healthVisibility: false,
    healthNote: "Failures return an explicit error on the response.",
    docs: { label: "Talk to us about API access", to: "/contact" },
  },
  {
    id: "payment-webhooks",
    name: "Payment webhooks",
    category: "webhooks",
    availability: "available",
    purpose:
      "Keeps billing state truthful: successful payments, refunds and disputes update your account without anyone re-keying them.",
    connectionMethod:
      "Signature-verified webhooks from the payment provider, processed once per event so retries cannot double-apply.",
    dataExchanged:
      "Inbound only: payment, refund and dispute events, plus the amount and the account they belong to.",
    permissions: "None on your side — this runs between TaaSFlow and the payment provider.",
    healthVisibility: true,
    healthNote:
      "Payment events and their applied state are visible to TaaSFlow administrators in the payments ledger.",
    docs: { label: "Pricing and billing", to: "/pricing" },
  },
  {
    id: "outbound-webhooks",
    name: "Outbound webhooks to your systems",
    category: "webhooks",
    availability: "planned",
    purpose:
      "Push hiring events — shortlist released, interview scheduled, offer accepted — into your own systems as they happen.",
    connectionMethod: "Not built yet.",
    dataExchanged: "Not applicable until the feature exists.",
    permissions: "Not applicable until the feature exists.",
    healthVisibility: false,
    healthNote: "Not applicable until the feature exists.",
    docs: null,
    plannedNote:
      "The internal event model exists; subscriber management, retries and signing are not built. No delivery date is promised.",
  },

  /* ------------------------------------------------------ crm / calendar */
  {
    id: "attio",
    name: "Attio",
    category: "crm",
    availability: "available",
    purpose:
      "Mirrors inbound hiring enquiries into a CRM so commercial follow-up never depends on someone remembering.",
    connectionMethod:
      "Authorised once by TaaSFlow through a managed connector; tokens are refreshed for us and never handled in the app.",
    dataExchanged:
      "Outbound: company name, contact name and email, the role discussed and where the enquiry came from.",
    permissions: "Create and update records in the connected CRM workspace.",
    healthVisibility: true,
    healthNote:
      "Probed from the admin integration health page: reachability, authorisation and the provider's own error text.",
    docs: { label: "How enquiries are handled", to: "/privacy" },
  },
  {
    id: "calendly",
    name: "Calendly",
    category: "calendar",
    availability: "available",
    purpose:
      "Books intro calls and interview slots against real availability instead of an email thread.",
    connectionMethod:
      "Managed connector authorised by TaaSFlow, plus an embedded scheduling flow on our public pages.",
    dataExchanged:
      "Outbound: invitee name, email and the meeting type. Inbound: the confirmed slot and its time zone.",
    permissions: "Read scheduling links and availability, and read booked events.",
    healthVisibility: true,
    healthNote: "Probed from the admin integration health page before a booking page is shown.",
    docs: { label: "Book a call", to: "/contact" },
  },

  /* ------------------------------------------------------ email / messaging */
  {
    id: "transactional-email",
    name: "Transactional email",
    category: "email",
    availability: "available",
    purpose:
      "Sends the messages a hiring process depends on: welcome mails, application confirmations, approval requests, receipts and the weekly digest.",
    connectionMethod:
      "Sent from a delegated TaaSFlow sending subdomain with domain authentication in place. Nothing to configure on your side.",
    dataExchanged:
      "Outbound: recipient name and address, and the content of the notification itself.",
    permissions:
      "None on your side. Recipients control their own notification preferences in the workspace.",
    healthVisibility: true,
    healthNote:
      "Sender-domain verification and send failures are probed and logged; delivery problems appear in the admin email log.",
    docs: { label: "Notification preferences", to: "/faq" },
  },
  {
    id: "microsoft-teams",
    name: "Microsoft Teams",
    category: "messaging",
    availability: "beta",
    purpose:
      "Posts new applications and inbound enquiries into a Teams channel so the team sees movement without opening the workspace.",
    connectionMethod:
      "Managed connector authorised once for a specific team and channel. Notifications are best-effort and never block an application.",
    dataExchanged:
      "Outbound only: a short notice with the role, the candidate reference and a link back into TaaSFlow.",
    permissions: "Post messages to the one channel you nominate.",
    healthVisibility: false,
    healthNote:
      "No health probe yet. Failed posts are logged server-side and swallowed so nothing user-facing breaks.",
    docs: { label: "Ask us to enable it", to: "/contact" },
  },

  /* ------------------------------------------------------ payments / auth */
  {
    id: "stripe",
    name: "Payments",
    category: "payments",
    availability: "available",
    purpose:
      "Takes payment for a pilot or a plan before a role goes live, with tax calculated at checkout.",
    connectionMethod:
      "Hosted checkout. Card details are entered on the provider's own page and never reach TaaSFlow.",
    dataExchanged:
      "Outbound: the plan or pilot being bought, the amount and your billing email. Inbound: payment outcome and receipt reference.",
    permissions: "None beyond completing your own checkout.",
    healthVisibility: true,
    healthNote:
      "Probed from the admin integration health page, including whether plan prices are present before anyone is sent to checkout.",
    docs: { label: "Plans and pricing", to: "/pricing" },
  },
  {
    id: "google-sign-in",
    name: "Google sign-in",
    category: "authentication",
    availability: "available",
    purpose: "Sign in to the workspace with an existing Google account instead of another password.",
    connectionMethod: "OAuth sign-in on the TaaSFlow login page.",
    dataExchanged:
      "Inbound: your name, email address and profile picture. No mail, calendar or file access is requested.",
    permissions: "Basic profile and email address only.",
    healthVisibility: false,
    healthNote: "Sign-in failures are reported on the login screen as they happen.",
    docs: { label: "Sign in", to: "/login" },
  },

  /* ------------------------------------------------------ analytics */
  {
    id: "web-analytics",
    name: "Website analytics and consent",
    category: "analytics",
    availability: "available",
    purpose:
      "Measures how the public site performs so we can fix what confuses visitors. Applies to taasflow.com, not to your hiring data.",
    connectionMethod:
      "Browser tags loaded only after the regional consent gate allows the relevant category. Declining consent means the tags never load.",
    dataExchanged:
      "Outbound: page views, referrer and anonymous interaction events. Consent state is sent with every measurement call.",
    permissions: "Your own consent choice, changeable at any time.",
    healthVisibility: false,
    healthNote: "Tag load state is visible to TaaSFlow administrators in the tracking policy panel.",
    docs: { label: "Privacy Notice", to: "/privacy" },
  },
  {
    id: "workspace-analytics",
    name: "In-workspace hiring analytics",
    category: "analytics",
    availability: "available",
    purpose:
      "Answers dropout, speed and spend questions from your own pipeline data — no external analytics product involved.",
    connectionMethod: "Built in. Nothing to connect.",
    dataExchanged:
      "None leaves the platform. Figures are computed from your own roles, candidates and decisions.",
    permissions: "Your workspace role decides what you can see.",
    healthVisibility: true,
    healthNote:
      "Every metric states its own freshness and says so plainly when there is not enough data to answer.",
    docs: { label: "Hiring intelligence", to: "/system" },
  },

  /* ------------------------------------------------------ planned */
  {
    id: "ats-sync",
    name: "Applicant tracking system sync",
    category: "ats",
    availability: "planned",
    purpose:
      "Two-way sync of roles, candidates and stage changes with an existing ATS so TaaSFlow is not a second system of record.",
    connectionMethod: "Not built yet.",
    dataExchanged: "Not applicable until the feature exists.",
    permissions: "Not applicable until the feature exists.",
    healthVisibility: false,
    healthNote: "Not applicable until the feature exists.",
    docs: null,
    plannedNote:
      "No ATS connector is implemented. If you need one, tell us which system you run — we prioritise by demand, not by logo.",
  },
  {
    id: "job-distribution",
    name: "Job board distribution",
    category: "job-distribution",
    availability: "planned",
    purpose:
      "Publish a live role to external job boards and aggregators from the same place you approve it.",
    connectionMethod: "Not built yet.",
    dataExchanged: "Not applicable until the feature exists.",
    permissions: "Not applicable until the feature exists.",
    healthVisibility: false,
    healthNote: "Not applicable until the feature exists.",
    docs: null,
    plannedNote:
      "Roles are published on the TaaSFlow job board today. No outbound board or aggregator feed is implemented.",
  },
  {
    id: "enrichment",
    name: "Third-party candidate data sources",
    category: "data-sources",
    availability: "planned",
    purpose:
      "Enrich candidate records from external data providers to widen discovery beyond direct applications.",
    connectionMethod: "Not built yet.",
    dataExchanged: "Not applicable until the feature exists.",
    permissions: "Not applicable until the feature exists.",
    healthVisibility: false,
    healthNote: "Not applicable until the feature exists.",
    docs: null,
    plannedNote:
      "Scoring today uses evidence taken from material the candidate submitted. No external enrichment source is connected.",
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
