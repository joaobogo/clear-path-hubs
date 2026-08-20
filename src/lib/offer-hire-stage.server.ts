import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads the pipeline stage for a set of candidate matches, org-scoped through
 * RLS. Used to reconcile offer records against the candidate's real stage.
 */
export async function loadMatchStages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  orgId: string,
  matchIds: string[],
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(matchIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from("candidate_matches")
    .select("id, stage")
    .eq("organization_id", orgId)
    .in("id", ids);
  return new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((data ?? []) as any[]).map((r) => [String(r.id), String(r.stage ?? "")]),
  );
}
