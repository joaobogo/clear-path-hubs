/**
 * Staff persona resolution for client-facing surfaces.
 *
 * Ensures internal account names (e.g. "Master Admin") are never leaked to
 * clients. Maps system senders and staff accounts to their public personas.
 */
const SYSTEM_ACCOUNTS = new Set([
    "Master Admin",
    "TaaSFlow",
    "System",
    "TaaSFlow system",
]);
/**
 * Maps a profile name/email and staff status to a client-friendly persona.
 */
export function resolveStaffPersona(args) {
    const { name, email, isStaff, roleLabel, maskStatus } = args;
    if (!isStaff) {
        return {
            name: name || email?.split("@")[0] || "Teammate",
            role: roleLabel || "Your team",
            isStaff: false,
        };
    }
    // Leak prevention: map internal root/system names to the team persona.
    const rawName = (name || email || "").toLowerCase();
    const isSystem = SYSTEM_ACCOUNTS.has(name || "") ||
        SYSTEM_ACCOUNTS.has(email || "") ||
        rawName.includes("admin") ||
        rawName.includes("system");
    if (isSystem || !name) {
        return {
            name: "TaaSFlow team",
            role: roleLabel || "TaaSFlow team",
            isStaff: true,
        };
    }
    // Human staff member with a real name.
    return {
        name: name + (maskStatus ? "" : " (Staff)"),
        role: roleLabel || "TaaSFlow recruiter",
        isStaff: true,
    };
}
