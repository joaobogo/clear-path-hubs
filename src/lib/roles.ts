// Client-safe role helpers shared by login redirect + guards.

export type MembershipRole =
  | "platform_admin"
  | "operations"
  | "client_admin"
  | "client_editor"
  | "client_viewer"
  | "candidate";

export type SessionMembership = {
  membership_id: string;
  organization_id: string | null;
  organization_name: string | null;
  role: MembershipRole;
  status: "active" | "invited" | "suspended" | "removed";
};

export type SessionContext = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  memberships: SessionMembership[];
  primary_role: MembershipRole | null;
};

export function pickPrimaryMembership(
  memberships: SessionMembership[],
): SessionMembership | null {
  const active = memberships.filter((m) => m.status === "active");
  if (active.length === 0) return null;
  const priority: MembershipRole[] = [
    "platform_admin",
    "operations",
    "client_admin",
    "client_editor",
    "client_viewer",
    "candidate",
  ];
  for (const role of priority) {
    const m = active.find((x) => x.role === role);
    if (m) return m;
  }
  return active[0];
}

export function landingPathForRole(role: MembershipRole | null): string {
  switch (role) {
    case "platform_admin":
    case "operations":
      return "/admin";
    case "client_admin":
    case "client_editor":
    case "client_viewer":
      return "/client";
    case "candidate":
      return "/me";
    default:
      return "/access-denied";
  }
}

export function canMutateAsRole(role: MembershipRole | null): boolean {
  return role === "platform_admin" || role === "operations" || role === "client_admin" || role === "client_editor";
}
