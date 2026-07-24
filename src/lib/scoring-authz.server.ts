/**
 * Scoring authorization boundary. Every client-facing server function that
 * returns candidate scoring data must go through this module. The rule is
 * absolute: nothing unpublished, unapproved, or belonging to a different
 * role may reach a client caller.
 *
 * How to use:
 *   import { readClientVisibleMatch, listClientVisibleMatches }
 *     from '@/lib/scoring-authz.server';
 *
 * Never read from `candidate_matches` directly in a client-facing server
 * function. Admin/reviewer surfaces are allowed to bypass this boundary
 * because they need to see all states.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;

/**
 * Fetch a single candidate submission the current client is authorized to
 * see. Returns null when the row exists but is not yet published to that
 * client, when the candidate belongs to a different organization, or when
 * the row does not exist at all.
 *
 * Never expose the distinction between "does not exist" and "not yet
 * published" to clients — both must look identical.
 */
export async function readClientVisibleMatch(
  supabase: DB,
  matchId: string,
) {
  const { data, error } = await supabase
    .from("client_visible_candidates" as never)
    .select("*")
    .eq("candidate_match_id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * List client-visible candidate submissions for one position. RLS + the
 * view together enforce org isolation; this helper just adds sane defaults.
 */
export async function listClientVisibleMatches(
  supabase: DB,
  opts: {
    organizationId: string;
    positionId?: string;
    limit?: number;
    offset?: number;
  },
) {
  let query = supabase
    .from("client_visible_candidates" as never)
    .select("*")
    .eq("organization_id", opts.organizationId)
    .order("final_score", { ascending: false })
    .order("scored_at", { ascending: false });

  if (opts.positionId) query = query.eq("position_id", opts.positionId);
  if (opts.limit) query = query.limit(opts.limit);
  if (opts.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Count of client-visible candidates. Used by dashboards, KPI cards, and
 * activity counters. Must never return values that include unpublished rows.
 */
export async function countClientVisibleMatches(
  supabase: DB,
  opts: { organizationId: string; positionId?: string },
) {
  let query = supabase
    .from("client_visible_candidates" as never)
    .select("candidate_match_id", { count: "exact", head: true })
    .eq("organization_id", opts.organizationId);

  if (opts.positionId) query = query.eq("position_id", opts.positionId);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Candidate-side guard. A candidate may only read the applications they
 * submitted themselves; never another candidate's data, and never data
 * about a position they did not apply to.
 */
export async function assertCandidateOwnsApplication(
  supabase: DB,
  applicationId: string,
  candidateAuthUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("applications")
    .select("id, candidate_profile_id, candidate_profiles!inner(user_id)")
    .eq("id", applicationId)
    .maybeSingle();
  if (error || !data) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileUserId = (data as any).candidate_profiles?.user_id;
  return profileUserId === candidateAuthUserId;
}
