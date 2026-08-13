/**
 * memberships.user_id points at the auth user, and there is no foreign key
 * between memberships and profiles, so PostgREST cannot embed
 * `profiles:user_id(...)`. Resolve the display fields with a second read and
 * attach them under the same `profiles` shape callers already expect.
 */
type AnyRow = Record<string, any>;

export type MemberProfile = { full_name: string | null; email: string | null };

export async function attachMemberProfiles<T extends AnyRow>(
  sb: any,
  rows: T[] | null | undefined,
  key: string = "user_id",
): Promise<(T & { profiles: MemberProfile | null })[]> {
  const list = (rows ?? []) as T[];
  const ids = Array.from(new Set(list.map((r) => r[key]).filter(Boolean))) as string[];
  const byUser = new Map<string, MemberProfile>();
  if (ids.length > 0) {
    const { data } = await sb
      .from("profiles")
      .select("auth_user_id, full_name, email")
      .in("auth_user_id", ids);
    for (const p of (data ?? []) as AnyRow[]) {
      if (p.auth_user_id)
        byUser.set(p.auth_user_id as string, {
          full_name: p.full_name ?? null,
          email: p.email ?? null,
        });
    }
  }
  return list.map((r) => ({ ...r, profiles: byUser.get(r[key] as string) ?? null }));
}
