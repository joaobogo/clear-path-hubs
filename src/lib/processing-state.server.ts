// Shared guard for candidate_match processing state writes.
//
// A match that already carries a live (completed, non-superseded) score run has
// been scored: whatever fails afterwards — an insights refresh, an evidence
// upsert, a graph trigger — must not repaint the row as "failed", because the
// workspace then shows a failure for a candidate that has a published score and
// leaves current_score_run_id attached to a failed row.
//
// Server-only.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** True when the match points at a completed, non-superseded score run. */
export async function hasLiveScoreRun(s: Any, matchId: string): Promise<boolean> {
  const { data: match } = await s
    .from("candidate_matches")
    .select("current_score_run_id")
    .eq("id", matchId)
    .maybeSingle();
  const runId = match?.current_score_run_id as string | null | undefined;
  if (!runId) return false;
  const { data: run } = await s
    .from("score_runs")
    .select("id,status,superseded_at")
    .eq("id", runId)
    .maybeSingle();
  return !!run && run.status === "completed" && !run.superseded_at;
}

/**
 * Write a terminal processing state, guarding the "failed + score run" mix.
 * Returns the state actually written.
 */
export async function writeProcessingState(
  s: Any,
  matchId: string,
  state: string,
  opts: { trace_id?: string | null; code?: string | null; message?: string | null } = {},
): Promise<string> {
  let finalState = state;
  let code = opts.code ?? null;
  let message = opts.message ?? null;

  if (state === "failed" && (await hasLiveScoreRun(s, matchId))) {
    // Keep the score that exists; drop the error so nothing renders as broken.
    finalState = "scored";
    code = null;
    message = null;
  }

  await s
    .from("candidate_matches")
    .update({
      processing_state: finalState,
      last_processing_trace_id: opts.trace_id ?? null,
      processing_error_code: code,
      processing_error_message: message,
    })
    .eq("id", matchId);

  return finalState;
}
