/**
 * One organization-scoped read for every business figure.
 *
 * Row-level visibility on an individual record decides what a person may open,
 * never how many an account has. Reading each table once — strictly scoped to
 * the organization the caller belongs to — is what keeps a figure identical on
 * every tile, banner and panel that prints it.
 *
 * This is the same pattern that fixed confirmed hires; every reader in
 * `src/lib/kpis/` goes through it so no surface can quietly narrow the rows.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export async function isOrgMember(
  supabase: AnyRow,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("organization_id", orgId)
    .limit(1);
  return (((data as AnyRow[]) ?? []).length ?? 0) > 0;
}

/**
 * Platform staff hold no membership row. Their own client is organization-wide
 * for most tables, but the membership roster is gated by an explicit
 * permission, so a staff read of `memberships` came back empty and every
 * seat tile they opened printed zero.
 */
export async function isPlatformStaffCaller(supabase: AnyRow): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id as string | undefined;
  if (!userId) return false;
  const { data } = await supabase.rpc("is_platform_staff", { _user: userId });
  return data === true;
}

/**
 * Every row of one table for one organization.
 *
 * Members read through the service client (scoped to their organization only);
 * platform staff hold no membership row, and their own read is already
 * organization-wide, so it is used as-is.
 */
export async function readOrgRows(
  supabase: AnyRow,
  orgId: string,
  table: string,
  select: string,
  refine?: (q: AnyRow) => AnyRow,
): Promise<AnyRow[]> {
  const [member, staff] = await Promise.all([
    isOrgMember(supabase, orgId),
    isPlatformStaffCaller(supabase),
  ]);
  let db: AnyRow = supabase;
  if (member || staff) {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    db = supabaseAdmin;
  }
  let query = db.from(table).select(select as never).eq("organization_id", orgId);
  if (refine) query = refine(query);
  const { data } = await query;
  return ((data as AnyRow[]) ?? []) as AnyRow[];
}
