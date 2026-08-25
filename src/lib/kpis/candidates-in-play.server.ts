/**
 * Candidates in play, and open offers — the one reader each.
 *
 * "In play" is every candidate the client can see whose pipeline stage has not
 * closed out. "Open offers" are candidates at the offer stage whose offer has
 * neither been confirmed as a hire nor closed. Both read the candidate match
 * rows once, through the organization-scoped reader.
 */
import { readOrgRows } from "@/lib/kpis/org-read.server";
import {
  indexConfirmedHires,
  loadConfirmedHires,
} from "@/lib/kpis/confirmed-hires.server";
import { ACCOUNT_TERMINAL_MATCH_STAGES } from "@/lib/admin-account-view";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const SELECT = "id, candidate_profile_id, position_id, stage, client_visibility, is_test_record";

/** Client-visible candidate matches for one organization. */
export async function loadVisibleMatches(
  supabase: AnyRow,
  orgId: string,
): Promise<AnyRow[]> {
  return readOrgRows(supabase, orgId, "candidate_matches", SELECT, (q) =>
    q.eq("client_visibility", "visible").eq("is_test_record", false),
  );
}

export function selectCandidatesInPlay(rows: readonly AnyRow[]): AnyRow[] {
  return rows.filter(
    (r) =>
      !(ACCOUNT_TERMINAL_MATCH_STAGES as readonly string[]).includes(
        String(r.stage ?? ""),
      ),
  );
}

export async function countCandidatesInPlay(
  supabase: AnyRow,
  orgId: string,
): Promise<number> {
  return selectCandidatesInPlay(await loadVisibleMatches(supabase, orgId)).length;
}

/** Offers still awaiting an outcome. */
export async function countOpenOffers(
  supabase: AnyRow,
  orgId: string,
): Promise<number> {
  const [matches, hires] = await Promise.all([
    loadVisibleMatches(supabase, orgId),
    loadConfirmedHires(supabase, orgId),
  ]);
  const hired = indexConfirmedHires(hires);
  return matches.filter(
    (r: AnyRow) =>
      String(r.stage ?? "") === "offer" && !hired.matchIds.has(String(r.id)),
  ).length;
}
