/**
 * Staff persona resolution for client-facing surfaces.
 *
 * Ensures internal account names (e.g. "Master Admin") are never leaked to
 * clients. Maps system senders and staff accounts to their public personas.
 */

export type StaffPersona = {
  name: string;
  role: string;
  isStaff: boolean;
  /** Badge to display after the name, e.g. "(Staff)" */
  badge?: string;
};

const SYSTEM_ACCOUNTS = new Set([
  "Master Admin",
  "TaaSFlow",
  "System",
  "TaaSFlow system",
  "TaaSFlow team",
  "System / unattributed",
]);

/**
 * Maps a profile name/email and staff status to a client-friendly persona.
 */
export function resolveStaffPersona(args: {
  name: string | null;
  email?: string | null;
  isStaff: boolean;
  roleLabel?: string | null;
  /** When true, avoids leaking staff status suffix. */
  maskStatus?: boolean;
}): StaffPersona {
  const { name, email, isStaff, roleLabel, maskStatus } = args;

  if (!isStaff) {
    // Teammates should not render as "Master Admin" either if they somehow get that name.
    const rawName = (name || "").toLowerCase();
    if (rawName.includes("master admin") || rawName === "system") {
      return {
        name: "Teammate",
        role: roleLabel || "Your team",
        isStaff: false,
      };
    }
    return {
      name: name || email?.split("@")[0] || "Teammate",
      role: roleLabel || "Your team",
      isStaff: false,
    };
  }

  // Staff leak prevention: map internal root/system/admin names to the team persona.
  const rawName = (name || email || "").toLowerCase();
  const isSystem =
    !name ||
    SYSTEM_ACCOUNTS.has(name || "") ||
    SYSTEM_ACCOUNTS.has(email || "") ||
    rawName.includes("admin") ||
    rawName.includes("system") ||
    rawName === "taasflow";

  if (isSystem) {
    return {
      name: "TaaSFlow team",
      role: "TaaSFlow team",
      isStaff: true,
    };
  }

  // Human staff member with a real name.
  return {
    name: maskStatus ? name || "TaaSFlow team" : `${name}`,
    role: roleLabel || "TaaSFlow recruiter",
    isStaff: true,
    badge: "(Staff)",
  };
}
