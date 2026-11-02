/**
 * The admin task behind "a candidate the pipeline cannot score always has an
 * open admin task". Server-only: takes the service-role client from its
 * caller. Used by the pipeline after every run and by the scoring service
 * when it parks a match itself (no dated roles), so a rescore started from
 * the review center or a bulk recompute leaves the same task the pipeline
 * would.
 */
import { candidateReviewTask, needsReviewTask } from "./unscored-review";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type UnscoredOutcome = {
  match_id: string;
  trace_id: string;
  final_state: string;
  steps: Array<{ step: string; ok: boolean }>;
};

/**
 * One open admin task per unscored match, saying why and what to do next.
 * Idempotent: any open candidate_review task on the match is reused, whoever
 * opened it (the pipeline, a second review, an operator backfill), so a
 * re-parked match never gets a second task for the same cause. Never
 * contacts the candidate, and never throws.
 */
export async function ensureUnscoredReviewTask(s: Any, outcome: UnscoredOutcome): Promise<void> {
  try {
    const { data: match } = await s
      .from("candidate_matches")
      .select(
        "id,organization_id,position_id,candidate_profile_id,current_score_run_id,processing_error_code,processing_error_message,positions(title),candidate_profiles(full_name)",
      )
      .eq("id", outcome.match_id)
      .maybeSingle();
    if (!match || !needsReviewTask(outcome, match)) return;
    const { data: open } = await s
      .from("tasks")
      .select("id")
      .eq("candidate_match_id", outcome.match_id)
      .eq("task_type", "candidate_review")
      .in("status", ["open", "in_progress"])
      .is("deleted_at", null)
      .limit(1);
    if ((open ?? []).length > 0) return;
    const task = candidateReviewTask({
      code: match.processing_error_code ?? outcome.final_state,
      message: match.processing_error_message ?? null,
      candidateName: (match.candidate_profiles as Any)?.full_name ?? null,
      positionTitle: (match.positions as Any)?.title ?? null,
    });
    await s.from("tasks").insert({
      organization_id: match.organization_id,
      position_id: match.position_id ?? null,
      candidate_match_id: outcome.match_id,
      candidate_profile_id: match.candidate_profile_id ?? null,
      task_type: "candidate_review",
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: "open",
      metadata: {
        source: "pipeline",
        reason: task.reason,
        final_state: outcome.final_state,
        trace_id: outcome.trace_id,
      },
    });
  } catch (e) {
    console.error("[pipeline] review task failed", outcome.match_id, (e as Error)?.message);
  }
}
