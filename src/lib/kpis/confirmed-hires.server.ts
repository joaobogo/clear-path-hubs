/**
 * Confirmed hires — the one reader.
 *
 * The offer record's own outcome is the only evidence of a hire: pipeline
 * stage, view aggregates and lane counts never decide it. Kept here with the
 * other business figures; the implementation lives in `hires/confirmed.server`
 * so existing callers keep working.
 */
export {
  loadOfferRecords,
  loadConfirmedHires,
  countConfirmedHiresForOrg,
  indexConfirmedHires,
  type ConfirmedHireRow,
} from "@/lib/hires/confirmed.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

/**
 * Platform-wide confirmed hires, for staff surfaces that report across every
 * account. Same predicate as the per-organization reader, so the admin work
 * queue and a client's own Offers strip can never disagree.
 */
export async function countConfirmedHiresPlatformWide(
  supabase: AnyClient,
): Promise<number> {
  const { normalizeOfferRecords } = await import("@/lib/hires/confirmed");
  const { selectConfirmedHires } = await import("@/lib/hires/confirmed");
  const { data } = await supabase.from("hire_records").select("id, status");
  return selectConfirmedHires(
    normalizeOfferRecords(((data as AnyClient[]) ?? []) as AnyClient[]) as Array<{
      status: string;
    }>,
  ).length;
}
