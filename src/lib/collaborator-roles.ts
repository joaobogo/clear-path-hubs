/**
 * Collaborator roles for a client workspace — the single source of truth for
 * what each role is called, what it can do, and which areas of the workspace
 * it can open.
 *
 * There are exactly three roles. There is no per-field visibility, no custom
 * permission matrix, and no role that can see internal recruiter data.
 *
 * The `AREA_ROLES` map below is read by the UI *and* by
 * `collaborator-roles.server.ts`, which asserts the same rule inside server
 * functions. Hidden navigation is never the only protection.
 */

/** Membership role stored on the row. */
export type CollaboratorRoleId = "client_admin" | "client_editor" | "client_viewer";

export const COLLABORATOR_ROLE_IDS: readonly CollaboratorRoleId[] = [
  "client_admin",
  "client_editor",
  "client_viewer",
];

/** Areas of the workspace access is decided for. */
export type WorkspaceArea =
  | "team"
  | "billing"
  | "role_settings"
  | "decisions"
  | "feedback"
  | "candidates";

/** Which roles may open each area. Enforced server-side by the same map. */
export const AREA_ROLES: Record<WorkspaceArea, readonly CollaboratorRoleId[]> = {
  team: ["client_admin"],
  billing: ["client_admin"],
  role_settings: ["client_admin", "client_editor"],
  decisions: ["client_admin", "client_editor"],
  feedback: ["client_admin", "client_editor", "client_viewer"],
  candidates: ["client_admin", "client_editor", "client_viewer"],
};

export const AREA_LABELS: Record<WorkspaceArea, string> = {
  team: "Team and invitations",
  billing: "Plan and billing",
  role_settings: "Role settings",
  decisions: "Candidate decisions",
  feedback: "Interview feedback",
  candidates: "Assigned candidates",
};

export type CollaboratorRole = {
  id: CollaboratorRoleId;
  label: string;
  summary: string;
  /** Plain sentences describing exactly what this role can do. */
  can: string[];
  /** Plain sentences describing what it cannot do. */
  cannot: string[];
};

export const COLLABORATOR_ROLES: Record<CollaboratorRoleId, CollaboratorRole> = {
  client_admin: {
    id: "client_admin",
    label: "Admin",
    summary: "Manages the team, the plan and billing.",
    can: [
      "Invite, change and remove teammates",
      "Open the plan, invoices and billing details",
      "Create and edit roles, and make candidate decisions",
      "Submit interview feedback",
    ],
    cannot: ["See TaaSFlow's internal recruiter notes or scoring"],
  },
  client_editor: {
    id: "client_editor",
    label: "Hiring manager",
    summary: "Runs roles and makes decisions.",
    can: [
      "Create and edit roles",
      "Advance, hold and decline candidates",
      "Request interviews and submit feedback",
    ],
    cannot: ["Manage the team", "Open the plan or billing"],
  },
  client_viewer: {
    id: "client_viewer",
    label: "Interviewer",
    summary: "Sees assigned candidates and submits feedback only.",
    can: ["See candidates on roles they are assigned to", "Submit interview feedback"],
    cannot: [
      "Create or edit roles",
      "Make candidate decisions",
      "Manage the team",
      "Open the plan or billing",
    ],
  },
};

export function collaboratorRole(role: string | null | undefined): CollaboratorRole | null {
  if (!role) return null;
  return COLLABORATOR_ROLES[role as CollaboratorRoleId] ?? null;
}

/** Plain label for any role value, including TaaSFlow staff. */
export function collaboratorRoleLabel(role: string | null | undefined): string {
  const known = collaboratorRole(role);
  if (known) return known.label;
  if (role === "platform_admin" || role === "operations") return "TaaSFlow team";
  return "Member";
}

/**
 * Can this role open this area? Platform staff always can — they operate the
 * platform and are not collaborators of the workspace.
 */
export function canAccessArea(role: string | null | undefined, area: WorkspaceArea): boolean {
  if (role === "platform_admin" || role === "operations") return true;
  if (!role) return false;
  return (AREA_ROLES[area] as readonly string[]).includes(role);
}

/** Message shown when a role is denied an area, naming who can help. */
export function areaDeniedMessage(area: WorkspaceArea): string {
  const allowed = AREA_ROLES[area].map((r) => COLLABORATOR_ROLES[r].label);
  const who =
    allowed.length === 1 ? `an ${allowed[0]}` : `an ${allowed.slice(0, -1).join(", ")} or ${allowed.at(-1)}`;
  return `${AREA_LABELS[area]} is limited to ${who}. Ask a workspace Admin if you need access.`;
}
