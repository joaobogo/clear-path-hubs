// The one place the "Good for future" system pool is resolved/created.
// Both talent-pool and talent-memory writes go through it so a tag made on a
// candidate profile lands in the same pool the /client/talent-pool chip reads.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export const GOOD_FOR_FUTURE_KEY = "good_for_future";

export async function ensureGoodForFuturePool(
  supabase: AnyRow,
  userId: string,
  orgId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("talent_pools")
    .select("id")
    .eq("organization_id", orgId)
    .eq("system_key", GOOD_FOR_FUTURE_KEY)
    .maybeSingle();
  if (existing) return (existing as AnyRow).id as string;
  const { data: created, error } = await supabase
    .from("talent_pools")
    .insert({
      organization_id: orgId,
      name: "Good for future",
      description: "Candidates worth revisiting on future roles.",
      is_system: true,
      system_key: GOOD_FOR_FUTURE_KEY,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (created as AnyRow).id as string;
}
