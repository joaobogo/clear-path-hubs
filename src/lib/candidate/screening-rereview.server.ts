/**
 * Late screening answers never replace a reviewed score.
 *
 * Shared by the candidate's answer flow (screening-answers.server) and the
 * parse_and_score drain (pipeline-runner.server). The review state is checked
 * twice: when the answers arrive, and again when the drain picks up the
 * rescore those answers queued, because staff may adjust or approve the score
 * in between (the next drain is ~2 minutes away, up to ~15 on retry backoff or
 * reclaim). A forced machine rescore at that point would supersede the
 * human_adjusted run and silently replace the reviewed published score, so the
 * drain cancels the job and staff get the same open re-review task instead.
 *
 * Nothing here approves, publishes, rescores, or changes stage, review status,
 * eligibility or visibility; it reads the match and opens one admin task.
 */
import {
  lateAnswerRescoreBlock,
  lateDealbreakerHits,
  screeningReReviewTask,
  type ReReviewTaskReason,
  type ScreeningQuestionRow,
} from "./screening-invite";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type ReviewState = {
  id: string;
  organization_id: string | null;
  position_id: string | null;
  candidate_profile_id: string | null;
  admin_status: string | null;
  current_score_run_id: string | null;
  approved_score_run_id: string | null;
  current_run_method: string | null;
};

export const REVIEW_MATCH_COLUMNS =
  "id,organization_id,position_id,candidate_profile_id,admin_status,current_score_run_id,approved_score_run_id";

/** evaluation_method of a score run; throws when it cannot be read (fail safe). */
async function runMethod(db: Db, runId: string | null): Promise<string | null> {
  if (!runId) return null;
  const { data: run, error } = await db
    .from("score_runs")
    .select("evaluation_method")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "score_run_lookup_failed");
  return (run?.evaluation_method as string | null) ?? null;
}

/** The match's review state; throws when it cannot be read (fail safe). */
export async function matchReviewState(db: Db, applicationId: string): Promise<ReviewState | null> {
  const { data: match, error } = await db
    .from("candidate_matches")
    .select(REVIEW_MATCH_COLUMNS)
    .eq("application_id", applicationId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "match_lookup_failed");
  if (!match) return null;
  return {
    ...(match as Omit<ReviewState, "current_run_method">),
    current_run_method: await runMethod(db, match.current_score_run_id ?? null),
  };
}

/** One open re-review task per match (reused when one is already open). */
export async function openReReviewTask(
  db: Db,
  args: {
    match: ReviewState | null;
    organizationId: string | null;
    positionId: string | null;
    candidateProfileId: string | null;
    applicationId: string;
    reason: ReReviewTaskReason;
    candidateName: string | null;
    positionTitle: string | null;
    questionIds: string[];
    dealbreakers: ScreeningQuestionRow[];
    heldAtDrain?: { jobId: string };
  },
): Promise<{ ok: boolean; error: string | null; reused?: boolean }> {
  const organizationId = args.match?.organization_id ?? args.organizationId;
  if (!organizationId) return { ok: false, error: "no_organization" };
  if (args.match) {
    const { data: open, error: openErr } = await db
      .from("tasks")
      .select("id")
      .eq("candidate_match_id", args.match.id)
      .eq("task_type", "candidate_review")
      .in("status", ["open", "in_progress"])
      .is("deleted_at", null)
      .contains("metadata", { source: "screening_answers" })
      .limit(1);
    if (!openErr && (open ?? []).length > 0) return { ok: true, error: null, reused: true };
  }
  const task = screeningReReviewTask({
    reason: args.reason,
    candidateName: args.candidateName,
    positionTitle: args.positionTitle,
    answeredCount: args.questionIds.length,
    dealbreakers: args.dealbreakers.map((q) => q.question),
    heldAtDrain: !!args.heldAtDrain,
  });
  const { error } = await db.from("tasks").insert({
    organization_id: organizationId,
    position_id: args.match?.position_id ?? args.positionId,
    candidate_match_id: args.match?.id ?? null,
    candidate_profile_id: args.match?.candidate_profile_id ?? args.candidateProfileId,
    task_type: "candidate_review",
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: "open",
    metadata: {
      source: "screening_answers",
      reason: args.reason,
      application_id: args.applicationId,
      question_ids: args.questionIds,
      dealbreaker_question_ids: args.dealbreakers.map((q) => q.id),
      ...(args.heldAtDrain ? { held_at: "drain", processing_job_id: args.heldAtDrain.jobId } : {}),
    },
  });
  if (error) return { ok: false, error: error.message ?? "task_insert_failed" };
  return { ok: true, error: null, reused: false };
}

/**
 * Drain-time gate for a rescore queued by late screening answers.
 *
 * Returns null when the rescore may run (the score is still unreviewed).
 * When the current run is human-adjusted or the match is approved, it opens
 * (or reuses) the 'Screening answers received, re-review' task and returns why,
 * so the drain cancels the job instead of forcing a machine rescore. Throws
 * when the review state, the answers or the task cannot be read or written:
 * the drain then re-arms the job for a retry and never rescores blind.
 */
export async function holdScreeningRescoreIfReviewed(
  db: Db,
  input: { applicationId: string; jobId: string },
): Promise<{ reason: "human_adjusted" | "approved"; message: string; taskReused: boolean } | null> {
  const review = await matchReviewState(db, input.applicationId);
  if (!review) return null;
  const block = lateAnswerRescoreBlock(review);
  if (!block) return null;

  const { data: app, error: appErr } = await db
    .from("applications")
    .select(
      "id,position_id,candidate_profile_id,candidate_profiles(full_name),positions(title,organization_id)",
    )
    .eq("id", input.applicationId)
    .maybeSingle();
  if (appErr) throw new Error(appErr.message ?? "application_lookup_failed");
  const positionId = (review.position_id ?? app?.position_id ?? null) as string | null;

  const [{ data: questions, error: qErr }, { data: answers, error: aErr }] = await Promise.all([
    positionId
      ? db
          .from("screening_questions")
          .select("id,question,answer_type,required,dealbreaker,preferred_answer,display_order")
          .eq("position_id", positionId)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    db
      .from("application_answers")
      .select("question_id,answer")
      .eq("application_id", input.applicationId),
  ]);
  if (qErr || aErr) throw new Error((qErr ?? aErr)?.message ?? "screening_lookup_failed");
  const all = (questions ?? []) as ScreeningQuestionRow[];
  const known = new Set(all.map((q) => q.id));
  const rows = ((answers ?? []) as Array<{ question_id: string; answer: unknown }>)
    .filter((a) => known.has(a.question_id))
    .map((a) => ({
      question_id: a.question_id,
      value:
        a.answer && typeof a.answer === "object" && "value" in (a.answer as object)
          ? (a.answer as { value: unknown }).value
          : a.answer,
    }));

  const pos = (app?.positions ?? null) as {
    title?: string | null;
    organization_id?: string | null;
  } | null;
  const profile = (app?.candidate_profiles ?? null) as { full_name?: string | null } | null;
  const task = await openReReviewTask(db, {
    match: review,
    organizationId: pos?.organization_id ?? null,
    positionId,
    candidateProfileId: (app?.candidate_profile_id as string | null) ?? null,
    applicationId: input.applicationId,
    reason: block,
    candidateName: profile?.full_name ?? null,
    positionTitle: pos?.title ?? null,
    questionIds: rows.map((r) => r.question_id),
    dealbreakers: lateDealbreakerHits(all, rows),
    heldAtDrain: { jobId: input.jobId },
  });
  if (!task.ok) throw new Error(`re_review_task_failed: ${task.error}`);
  return {
    reason: block,
    taskReused: task.reused === true,
    message:
      block === "human_adjusted"
        ? "Rescore from late screening answers cancelled: the current score was adjusted by a reviewer after the answers arrived. The reviewed score is kept; a re-review task is open."
        : "Rescore from late screening answers cancelled: the match was approved after the answers arrived. The reviewed score is kept; a re-review task is open.",
  };
}
