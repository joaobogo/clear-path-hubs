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
import { laneFor } from "@/lib/client-pipeline-lane";

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

/**
 * Candidates sitting on an open offer — through the ONE lane derivation.
 *
 * This read a literal `stage === "offer"` string, which is the thing
 * `laneFor` exists to stop. Once `laneFor` began demoting a candidate parked
 * in the `hired` stage with an unconfirmed offer into the `offer` lane
 * (CLI-001), this predicate could no longer see that population at all: their
 * stage is `hired`, and they are not confirmed hires either, so they were
 * counted nowhere. The client's Roles cards read "Offers 2" and linked to an
 * Offers board whose own tile said 0 — the same disagreement one surface
 * along, and the exact thing hires.functions.ts promises this reader prevents
 * ("so this strip can never contradict the board underneath it, the Roles
 * list, or the Candidates page").
 */
export function selectOpenOffers<T extends { stage?: unknown }>(
  rows: readonly T[],
  isConfirmedHire: (row: T) => boolean,
): T[] {
  return rows.filter((r) => {
    // A confirmed hire is never an open offer, whatever stage the pipeline
    // left the candidate in — the offer record decides, as everywhere else.
    if (isConfirmedHire(r)) return false;
    return (
      laneFor({
        stage: String(r.stage ?? ""),
        // Established false by the early return above.
        hire_confirmed: false,
      }) === "offer"
    );
  });
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
  // Match id OR position+profile, the same pairing loadKpiRows and the
  // candidates DTO use. Testing only the match id made a hire recorded
  // against the pair — with a null candidate_match_id — a confirmed hire to
  // every other surface and an open offer to this one.
  return selectOpenOffers(matches, (r: AnyRow) =>
    hired.matchIds.has(String(r.id)) ||
    hired.pairs.has(`${r.position_id}:${r.candidate_profile_id}`),
  ).length;
}
