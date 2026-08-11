/**
 * Public changelog — verified releases only.
 * ------------------------------------------------------------------
 * Rules for this file:
 *   1. One entry per change that exists in the shipped product. Every
 *      entry must trace to code, a route, or a database object that is
 *      live right now. No roadmap items, no back-dated history.
 *   2. No historical releases were reconstructed. The changelog starts
 *      with the current verified release; future releases are appended
 *      above it as they ship.
 *   3. `docHref` must point at a page that exists. Dead links are worse
 *      than no link.
 */

export const CHANGELOG_CATEGORIES = [
  "New",
  "Improved",
  "Fixed",
  "Security",
  "Integration",
  "Developer",
] as const;

export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

/** Product areas map to real surfaces of the platform. */
export const PRODUCT_AREAS = [
  "Platform",
  "Decision Workspace",
  "Agents",
  "Hiring Intelligence",
  "Notifications",
  "Candidate Experience",
  "Administration",
  "Security & Trust",
] as const;

export type ProductArea = (typeof PRODUCT_AREAS)[number];

/** Which live product preview to render beside an entry, when useful. */
export type PreviewKind = "agent-runs" | "intelligence" | "lifecycle" | "decision-workspace";

export interface ChangelogEntry {
  id: string;
  category: ChangelogCategory;
  area: ProductArea;
  /** One line. What changed. */
  summary: string;
  /** One or two lines. What it means for the person using the product. */
  impact: string;
  /** Rollout reality: who has it, and under what conditions. */
  availability: string;
  /** Optional in-product documentation or the surface itself. */
  docHref?: string;
  docLabel?: string;
  preview?: PreviewKind;
}

export interface ChangelogRelease {
  /** ISO date the release went live. */
  date: string;
  /** Human release label. Calendar-versioned: YYYY.MM[.n]. */
  version: string;
  title: string;
  /** Two lines at most — the theme of the release. */
  summary: string;
  entries: ChangelogEntry[];
}

export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    date: "2026-08-11",
    version: "2026.08.1",
    title: "Launch hardening: consent, tenant boundaries, and broken links",
    summary:
      "A stability and privacy pass ahead of launch. Every item below was verified against the running product, not planned.",
    entries: [
      {
        id: "consent-gated-tracking",
        category: "Improved",
        area: "Security & Trust",
        summary: "Analytics and advertising pixels load only after you accept them.",
        impact:
          "Nothing is loaded before a choice is made, and if the consent setting cannot be read the trackers stay off rather than defaulting on.",
        availability: "Live on every public page.",
        docHref: "/security",
        docLabel: "Trust Center",
      },
      {
        id: "cross-tenant-write-binding",
        category: "Security",
        area: "Security & Trust",
        summary:
          "Client decisions and hire records are bound in the database to the organisation that owns the candidate.",
        impact:
          "A decision or hire can only ever be written against a candidate your organisation actually has access to. The check runs in the database, not in the interface.",
        availability: "Applied platform-wide.",
      },
      {
        id: "candidate-read-scoping",
        category: "Security",
        area: "Candidate Experience",
        summary: "Candidate-facing reads return an explicit list of fields instead of whole rows.",
        impact:
          "When you look up a role you applied to, you see the role and its employer — never internal notes, review history or other applicants' data.",
        availability: "Live for all candidate accounts.",
      },
      {
        id: "orphan-cv-processing",
        category: "Fixed",
        area: "Candidate Experience",
        summary: "An abandoned CV upload no longer holds up the processing queue.",
        impact:
          "If someone uploads a CV and leaves before submitting, the file is cleared from the queue instead of blocking the applications behind it.",
        availability: "Live for every role.",
      },
      {
        id: "sitemap-broken-links",
        category: "Fixed",
        area: "Platform",
        summary: "Removed 232 links to pages that were never published.",
        impact:
          "Search results and internal links now point only at pages that exist. The site index is built from published content rather than files on disk.",
        availability: "Live on the public site.",
      },
      {
        id: "payment-environment-validation",
        category: "Security",
        area: "Platform",
        summary: "Checkout requests validate which payment environment they name.",
        impact:
          "A request can no longer ask for a payment environment that was not offered to it.",
        availability: "Applied to every checkout path.",
      },
      {
        id: "phone-layouts",
        category: "Improved",
        area: "Decision Workspace",
        summary: "Phone layouts reworked down to a 375px screen.",
        impact:
          "Candidate tables stack instead of overflowing, and buttons meet a 44px tap target across the client workspace.",
        availability: "Live on all public and client-workspace pages.",
      },
    ],
  },
  {

    date: "2026-08-04",
    version: "2026.08.0",
    title: "Measured status, tiered notifications, and configurable verticals",
    summary:
      "The first published release of the TaaSFlow changelog. Everything below is live in the product today; no earlier history has been reconstructed.",
    entries: [
      {
        id: "public-status-page",
        category: "New",
        area: "Platform",
        summary: "Public system status page covering ten core services.",
        impact:
          "You can check availability yourself before raising a question. A service reads Unknown when it cannot be measured, so a green state always means something was actually checked.",
        availability: "Live for everyone, no sign-in required.",
        docHref: "/status",
        docLabel: "Open system status",
      },
      {
        id: "degraded-mode",
        category: "New",
        area: "Decision Workspace",
        summary: "In-product degraded-mode banner tied to measured service health.",
        impact:
          "When processing is delayed or an action is temporarily unavailable, the workspace says which area is affected instead of failing silently.",
        availability: "Automatic in the client workspace during a disruption or maintenance window.",
      },
      {
        id: "notification-tiers",
        category: "Improved",
        area: "Notifications",
        summary:
          "Notifications rebuilt into four tiers — critical, action required, important update, informational.",
        impact:
          "Each notification states what happened, what it affects, why it matters, when, and who acted, with one clear next action. Critical items stay until resolved.",
        availability: "Live for all client and admin accounts.",
      },
      {
        id: "recommendations",
        category: "New",
        area: "Hiring Intelligence",
        summary: "Analytics now surface detected issues with a recommended action.",
        impact:
          "Stalled stages, thin evidence, narrow pools and compressed scores are linked to a specific action and the data behind it, so numbers turn into decisions.",
        availability: "Live on the Intelligence and Analytics pages for signed-in client accounts.",
        docHref: "/system",
        docLabel: "How the intelligence layer works",
        preview: "intelligence",
      },
      {
        id: "vertical-configuration",
        category: "New",
        area: "Platform",
        summary: "Vertical configuration modules for each supported hiring environment.",
        impact:
          "Role families, requirements, evidence types, scoring weights, compliance checks and approval controls now differ by vertical, and the differences are visible in the interface.",
        availability: "Live across the industries directory and applied to new roles.",
        docHref: "/industries",
        docLabel: "Browse vertical configurations",
      },
      {
        id: "role-lifecycle",
        category: "Improved",
        area: "Decision Workspace",
        summary: "Every active role shows its full lifecycle from intake to hire.",
        impact:
          "You can see the current stage, what has completed, and what is waiting on a decision without asking for an update.",
        availability: "Live for every active role in the client workspace.",
        preview: "lifecycle",
      },
      {
        id: "agent-ops-console",
        category: "Developer",
        area: "Agents",
        summary: "Internal Agent Operations Console for run inspection and safe controls.",
        impact:
          "Runs, queues and failures are inspectable with retry, pause, cancel and escalate controls. Inspector output is redacted, and every control writes an audit record.",
        availability: "Restricted to authorised platform administrators.",
        docHref: "/agents",
        docLabel: "About the agent layer",
        preview: "agent-runs",
      },
      {
        id: "integration-health",
        category: "Integration",
        area: "Platform",
        summary: "Integration directory reports measured health and availability labels.",
        impact:
          "Each integration shows whether it is connected and responding, so you are not guessing which connections are live.",
        availability: "Live in the public integrations directory and the admin integrations view.",
        docHref: "/integrations",
        docLabel: "Integration directory",
      },
      {
        id: "search-path-hardening",
        category: "Security",
        area: "Security & Trust",
        summary:
          "Row-level security helpers and privileged database functions run with a fixed search path.",
        impact:
          "Tenant isolation is enforced in the database itself, so one organisation's data cannot be read through another account.",
        availability: "Applied platform-wide.",
        docHref: "/security",
        docLabel: "Trust Center",
      },
      {
        id: "empty-and-loading-states",
        category: "Fixed",
        area: "Candidate Experience",
        summary: "Generic spinners replaced with reason-aware empty and loading states.",
        impact:
          "A blank screen now explains whether work is in progress, blocked, or genuinely empty — with no fabricated progress percentages.",
        availability: "Live across client, candidate and admin surfaces.",
      },
    ],
  },
];

export const CHANGELOG_LAST_UPDATED = CHANGELOG_RELEASES[0]!.date;

/** Only categories and areas that actually appear are offered as filters. */
export function usedCategories(): ChangelogCategory[] {
  const used = new Set(CHANGELOG_RELEASES.flatMap((r) => r.entries.map((e) => e.category)));
  return CHANGELOG_CATEGORIES.filter((c) => used.has(c));
}

export function usedAreas(): ProductArea[] {
  const used = new Set(CHANGELOG_RELEASES.flatMap((r) => r.entries.map((e) => e.area)));
  return PRODUCT_AREAS.filter((a) => used.has(a));
}

export function formatReleaseDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
