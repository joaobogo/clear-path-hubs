// Canonical authorization model for TaaSFlow — shared (client-safe) definitions.
//
// This module is the single source of truth for role names, client permission
// keys and their default grants. It contains NO server logic and NO secrets, so
// it can be imported from components to render permission-aware UI.
//
// IMPORTANT: UI gating built on these constants is *supplementary*. Every rule
// here is independently enforced in Postgres (RLS policies + membership guard
// trigger) and in server functions (see `authz.server.ts`).

/** Every role that can exist on a membership row. */
export const MEMBERSHIP_ROLES = [
  "platform_admin",
  "operations",
  "client_admin",
  "client_editor",
  "client_viewer",
  "candidate",
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/** Roles operated by TaaSFlow itself. */
export const PLATFORM_STAFF_ROLES = ["platform_admin", "operations"] as const;

/** Roles that belong to a client organization workspace. */
export const CLIENT_ROLES = [
  "client_admin",
  "client_editor",
  "client_viewer",
] as const;
export type ClientRole = (typeof CLIENT_ROLES)[number];

export function isPlatformStaffRole(role: string | null | undefined): boolean {
  return role === "platform_admin" || role === "operations";
}

export function isClientRole(role: string | null | undefined): role is ClientRole {
  return (CLIENT_ROLES as readonly string[]).includes(role ?? "");
}

/** Granular permissions attached to a client-organization seat. */
export const CLIENT_PERMISSIONS = [
  "view_candidates",
  "add_feedback",
  "request_interviews",
  "manage_jobs",
  "invite_members",
  "view_reports",
] as const;
export type ClientPermission = (typeof CLIENT_PERMISSIONS)[number];

export const CLIENT_PERMISSION_LABELS: Record<ClientPermission, string> = {
  view_candidates: "View candidates",
  add_feedback: "Add feedback",
  request_interviews: "Request interviews",
  manage_jobs: "Manage jobs",
  invite_members: "Invite members",
  view_reports: "View reports",
};

export const CLIENT_PERMISSION_DESCRIPTIONS: Record<ClientPermission, string> = {
  view_candidates: "See candidates that TaaSFlow has approved for this organization.",
  add_feedback: "Leave decisions, notes and feedback on candidates.",
  request_interviews: "Request and schedule interviews.",
  manage_jobs: "Create, edit and close positions.",
  invite_members: "Invite additional recruiter seats (subject to the seat limit).",
  view_reports: "Open analytics, operations and portfolio reporting.",
};

/**
 * Default permission set granted when a seat is created with a given role.
 * Mirrors `public.default_permissions_for_role()` in the database — keep both
 * in sync; the database value is authoritative.
 */
export const DEFAULT_PERMISSIONS_FOR_ROLE: Record<ClientRole, ClientPermission[]> = {
  client_admin: [...CLIENT_PERMISSIONS],
  client_editor: [
    "view_candidates",
    "add_feedback",
    "request_interviews",
    "manage_jobs",
    "view_reports",
  ],
  client_viewer: ["view_candidates", "view_reports"],
};

/** Owner seat + this many recruiter seats. Overridable per organization by staff. */
export const DEFAULT_CLIENT_SEAT_LIMIT = 3;
export const MAX_CLIENT_SEAT_LIMIT = 3;

export function hasClientPermission(
  permissions: readonly string[] | null | undefined,
  permission: ClientPermission,
): boolean {
  return (permissions ?? []).includes(permission);
}

/**
 * Candidate visibility ladder. A candidate is invisible to a client until an
 * authorized admin approves that candidate for that specific job + client, and
 * contact details stay masked until a *separate* release.
 */
export type CandidateVisibilityLevel = "hidden" | "approved" | "contact_released";

export function candidateVisibilityLevel(match: {
  client_visibility?: string | null;
  contact_released_at?: string | null;
}): CandidateVisibilityLevel {
  if (match.client_visibility !== "visible") return "hidden";
  return match.contact_released_at ? "contact_released" : "approved";
}

/** Placeholder shown wherever contact details are withheld. */
export const MASKED_CONTACT = "Released after approval";

export function maskEmail(email: string | null | undefined): string {
  if (!email) return MASKED_CONTACT;
  const [user, domain] = email.split("@");
  if (!domain) return MASKED_CONTACT;
  const head = user.slice(0, 1);
  return `${head}${"•".repeat(Math.max(3, user.length - 1))}@${domain.replace(/^[^.]*/, "•••")}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return MASKED_CONTACT;
  return `••• ••• ${phone.slice(-2)}`;
}
