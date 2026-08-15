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
};

const SYSTEM_ACCOUNTS = new Set([
  "Master Admin",
  "TaaSFlow",
  "System",
  "TaaSFlow system",
]);

/**
 * Maps a profile name/email and staff status to a client-friendly persona.
 */
export function resolveStaffPersona(args: {
  name: string | null;
  email?: string | null;
  isStaff: boolean;
  roleLabel?: string | null;
}): StaffPersona {
  const { name, email, isStaff, roleLabel } = args;

  if (!isStaff) {
    return {
      name: name || email?.split("@")[0] || "Teammate",
      role: roleLabel || "Your team",
      isStaff: false,
    };
  }

  // Leak prevention: map internal root/system names to the team persona.
  const rawName = name || email || "";
  if (SYSTEM_ACCOUNTS.has(rawName) || !name) {
    return {
      name: "TaaSFlow team",
      role: roleLabel || "TaaSFlow team",
      isStaff: true,
    };
  }

  // Human staff member with a real name.
  return {
    name: name,
    role: roleLabel || "TaaSFlow recruiter",
    isStaff: true,
  };
}
