/**
 * Server-side guards for position and SLA ownership.
 *
 * Enforces that only platform staff (platform_admin or operations) or null
 * can be assigned as owners or backups.
 */
// type-safe Admin helper for ownership checks
type GuardAdmin = { from: (t: string) => any };

/**
 * Asserts that a user is allowed to own a position or commitment.
 * Must be platform staff or null (unassigned).
 */
export async function assertAllowedOwner(admin: GuardAdmin, userId: string | null): Promise<void> {
  if (!userId) return; // Unassigned is always allowed

  // memberships.user_id = auth.users.id
  const { data, error } = await (admin as any)
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["platform_admin", "operations"])
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Ownership restricted to platform staff.");
  }
}
