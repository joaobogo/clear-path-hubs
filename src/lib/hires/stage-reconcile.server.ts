/**
 * Keep hire_records in step with the pipeline stage, whatever moved it.
 *
 * The Offers board and every money figure read hire_records; the pipeline reads
 * candidate_matches.stage. This reconciliation used to live inline in
 * moveMatchStage only — the kanban drag. The buttons ("Make offer", "Confirm
 * hire") go through clientAction, which moved the stage and wrote no record, so
 * a button-made offer was invisible on the Offers board and a button-confirmed
 * hire never reached the finance tiles.
 *
 * It was then a private helper in client-decisions.functions.ts whose docstring
 * promised "one helper, called by both paths, so there is no third copy to
 * forget next time" — and interview feedback, which may move a candidate from
 * Offer to Hired on a positive outcome, was exactly that third path and never
 * called it. It lives here now so no stage writer has to know which module the
 * helper happens to sit in.
 *
 * Entering Offer writes offer_drafted — the client has decided to make an
 * offer, not told us the terms; claiming it was sent would put a date on the
 * board nobody chose. Entering Hired inserts or promotes to hire_confirmed.
 *
 * The read side depends on this: `laneFor` keeps a candidate out of the Hired
 * lane until an offer record confirms the hire, so a stage write that skips
 * this reconciliation would leave that person sitting in Offer.
 */
import type { MatchStage } from "@/lib/client-match-stage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function reconcileHireRecordForStage(
  supabase: AnyClient,
  args: {
    matchId: string;
    orgId: string;
    positionId: string | null;
    candidateProfileId: string | null;
    toStage: MatchStage;
  },
): Promise<void> {
  if (args.toStage !== "offer" && args.toStage !== "hired") return;

  const { data: existing } = await supabase
    .from("hire_records")
    .select("id, status")
    .eq("candidate_match_id", args.matchId)
    .maybeSingle();

  if (args.toStage === "offer") {
    if (!existing) {
      await supabase.from("hire_records").insert({
        candidate_match_id: args.matchId,
        organization_id: args.orgId,
        position_id: args.positionId,
        candidate_profile_id: args.candidateProfileId,
        status: "offer_drafted",
      } as never);
    }
    return;
  }

  if (!existing) {
    await supabase.from("hire_records").insert({
      candidate_match_id: args.matchId,
      organization_id: args.orgId,
      position_id: args.positionId,
      candidate_profile_id: args.candidateProfileId,
      status: "hire_confirmed",
      hired_at: new Date().toISOString(),
    } as never);
  } else if (existing.status !== "hire_confirmed") {
    await supabase
      .from("hire_records")
      .update({ status: "hire_confirmed", hired_at: new Date().toISOString() } as never)
      .eq("id", existing.id);
  }
}
