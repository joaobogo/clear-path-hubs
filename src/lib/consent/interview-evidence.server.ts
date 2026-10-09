/**
 * One place that answers "did this match reach the interview stage?" from the
 * database. The CV download gate and the interview-feedback guard must agree, so
 * both call this instead of repeating the queries. Server only.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reachedInterview } from "@/lib/consent/cv-consent-gate";

export type InterviewEvidenceCounts = {
  stageHistory: number;
  requestDecisions: number;
  reversedDecisions: number;
  interviewRows: number;
};

export async function loadInterviewEvidence(
  matchId: string,
  opts: { includeInterviewRows?: boolean } = {},
): Promise<InterviewEvidenceCounts> {
  const head = { count: "exact", head: true } as const;
  const [stage, live, reversed, rows] = await Promise.all([
    supabaseAdmin
      .from("candidate_stage_history")
      .select("id", head)
      .eq("candidate_match_id", matchId)
      .eq("to_stage", "interview_process"),
    supabaseAdmin
      .from("client_decisions")
      .select("id", head)
      .eq("candidate_match_id", matchId)
      .eq("decision", "request_interview")
      .is("reversed_at", null),
    supabaseAdmin
      .from("client_decisions")
      .select("id", head)
      .eq("candidate_match_id", matchId)
      .eq("decision", "request_interview")
      .not("reversed_at", "is", null),
    opts.includeInterviewRows === false
      ? Promise.resolve({ count: 0 })
      : supabaseAdmin
          .from("interviews")
          .select("id", head)
          .eq("candidate_match_id", matchId),
  ]);
  return {
    stageHistory: stage.count ?? 0,
    requestDecisions: live.count ?? 0,
    reversedDecisions: reversed.count ?? 0,
    interviewRows: rows.count ?? 0,
  };
}

/** True when the evidence proves the candidate reached the interview stage. */
export async function matchReachedInterview(
  matchId: string,
  opts: { includeInterviewRows?: boolean } = {},
): Promise<boolean> {
  return reachedInterview(await loadInterviewEvidence(matchId, opts));
}
