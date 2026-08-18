/**
 * Client-visible candidate identity hydration.
 *
 * Employer (client) roles hold no RLS read on `candidate_profiles`, so a
 * PostgREST embed of `candidate_profiles(...)` returns null for them and every
 * card degrades to the anonymous "Candidate" placeholder. Visibility is already
 * decided upstream by `candidate_matches` RLS (`client_visibility = 'visible'`
 * and `canonical_state = 'published_to_client'`): if a row reached this helper,
 * the caller is allowed to see that candidate.
 *
 * This helper fills the profile for those already-authorized rows using the
 * privileged client. Contact fields (email, phone) are included because published
 * matches are contact-released at publish time by the publish handler; the DTO
 * still verifies `contact_released_at` before surfacing them in
 * `toClientCandidateDTO`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/** Profile columns safe to show for a published match (contact-released at publish). */
export const SAFE_CANDIDATE_PROFILE_COLUMNS =
  "id, full_name, email, phone, headline, location, city, region, country, timezone, availability, " +
  "years_experience, summary, experience, skills, education, languages, " +
  "work_authorization, linkedin_url, portfolio_url, website_url, certifications, " +
  "compensation_preferences, current_cv_file_id";

/**
 * Attach `candidate_profiles` to candidate_matches rows that came back without
 * it. Rows are returned in the same order; existing embedded values win so a
 * caller with real RLS access is never overwritten.
 */
export async function hydrateClientCandidateProfiles<T extends AnyRow>(
  rows: T[] | null | undefined,
): Promise<T[]> {
  const list = (rows ?? []) as AnyRow[];
  if (list.length === 0) return list as T[];

  const missing = new Set<string>();
  for (const r of list) {
    const id = r?.candidate_profile_id ?? r?.candidate_profiles?.id;
    if (id && !r?.candidate_profiles?.full_name) missing.add(String(id));
  }
  if (missing.size === 0) return list as T[];

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("candidate_profiles")
    .select(SAFE_CANDIDATE_PROFILE_COLUMNS)
    .in("id", Array.from(missing));
  if (error) return list as T[];

  const byId = new Map<string, AnyRow>();
  for (const p of (data as AnyRow[]) ?? []) byId.set(String(p.id), p);

  return list.map((r) => {
    const id = r?.candidate_profile_id ?? r?.candidate_profiles?.id;
    const profile = id ? byId.get(String(id)) : null;
    if (!profile) return r;
    return { ...r, candidate_profiles: { ...profile, ...(r.candidate_profiles ?? {}) } };
  }) as T[];
}

/**
 * Match id → candidate display name, for surfaces that only hold interview /
 * scorecard rows. Same authorization story as `hydrateClientCandidateProfiles`:
 * visibility was already decided by `candidate_matches` RLS, so only rows the
 * caller can read are resolved, and no contact fields are returned.
 */
export async function resolveMatchCandidateNames(
  supabase: AnyRow,
  orgId: string,
  matchIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(matchIds.filter(Boolean)));
  if (ids.length === 0) return out;
  const { data: matches } = await supabase
    .from("candidate_matches")
    .select("id, candidate_profile_id")
    .eq("organization_id", orgId)
    .in("id", ids);
  const rows = ((matches as AnyRow[]) ?? []).map((m) => ({ ...m, candidate_profiles: null }));
  const hydrated = await hydrateClientCandidateProfiles(rows);
  for (const r of hydrated) {
    const name = r?.candidate_profiles?.full_name;
    if (name) out.set(String(r.id), String(name));
  }
  return out;
}
