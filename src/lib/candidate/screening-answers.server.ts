/**
 * The candidate answers the role's screening questions on an EXISTING
 * application — for a CV that reached us by email, a staff entry made from
 * one, or an import of people who applied (screeningLinkSource). Form
 * applications and staff assignments never get the form here.
 *
 * Verified by reference + the email on the application on every call, exactly
 * like the rest of the status page (findApplication). Only unanswered
 * questions are offered and stored; a stored answer is never overwritten.
 *
 * What happens next depends on the score:
 *  - unreviewed match: the application is queued for parse_and_score, the
 *    same durable job a new application writes, so the scorer weighs the
 *    answers and applies the dealbreaker rule on the rescore;
 *  - current run human-adjusted, or match approved: NO rescore (it would
 *    silently replace the reviewed published score). The answers are stored
 *    and one open 'candidate_review' task asks staff to re-review.
 * A failed job insert also opens that task, so answers are never stored with
 * nothing to act on them. Nothing here approves, publishes, or changes stage,
 * review status, eligibility or visibility.
 */
import { findApplication } from "./apply-status.server";
import {
  SCREENING_OPEN_POSITION_STATUSES,
  applicationIsClosed,
  lateAnswerRescoreBlock,
  lateDealbreakerHits,
  prepareLateAnswers,
  screeningLinkSource,
  screeningReReviewTask,
  screeningStillOpen,
  unansweredQuestions,
  type LateAnswerInput,
  type ReReviewTaskReason,
  type ScreeningQuestionRow,
} from "./screening-invite";
import { DIRECT_CONTACT_EMAIL } from "@/config/direct-contact";

export interface PublicScreeningQuestion {
  id: string;
  question: string;
  answer_type: string;
  required: boolean;
  why_asked: string | null;
}

export interface MyScreeningQuestions {
  /** True when there are questions the candidate can answer now. */
  open: boolean;
  /** The unanswered questions, in the order the apply form shows them. */
  questions: PublicScreeningQuestion[];
  /** Plain reason when the questions exist but cannot be answered any more. */
  reason: string | null;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Found = NonNullable<Awaited<ReturnType<typeof findApplication>>>;

async function screeningContext(app: Found) {
  const db = await admin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = app as any;
  const [{ data: questions, error: qErr }, { data: answers, error: aErr }] = await Promise.all([
    db
      .from("screening_questions")
      .select(
        "id,question,answer_type,required,why_asked,display_order,dealbreaker,preferred_answer",
      )
      .eq("position_id", row.position_id as string)
      .order("display_order", { ascending: true }),
    db
      .from("application_answers")
      .select("question_id")
      .eq("application_id", row.id as string),
  ]);
  if (qErr || aErr) throw new Error((qErr ?? aErr)?.message ?? "screening_lookup_failed");
  const all = (questions ?? []) as ScreeningQuestionRow[];
  const answeredIds = ((answers ?? []) as Array<{ question_id: string }>).map((a) => a.question_id);
  const pos = row.positions as { status?: string | null } | null;
  const positionOpen = SCREENING_OPEN_POSITION_STATUSES.includes(pos?.status ?? "");
  const closed = applicationIsClosed({
    status: row.status ?? null,
    withdrawn_at: row.withdrawn_at ?? null,
  });
  // Only applications that reached us without the form, from an allowlisted
  // source. A form applicant or a staff assignment sees nothing here.
  const sourceOk = screeningLinkSource({
    source: row.source ?? null,
    source_channel: row.source_channel ?? null,
    consent: row.consent ?? null,
  }).ok;
  const pending = sourceOk && screeningStillOpen(all, answeredIds);
  return {
    all,
    unanswered: unansweredQuestions(all, answeredIds),
    pending,
    open: pending && positionOpen && !closed,
    reason: !pending
      ? null
      : closed
        ? "This application is closed, so there is nothing to answer."
        : !positionOpen
          ? "This role has closed, so its questions can no longer be answered."
          : null,
  };
}

/** Unanswered questions for the candidate's own application, or null. */
export async function loadScreeningByReference(
  reference: string,
  email: string,
): Promise<MyScreeningQuestions | null> {
  const app = await findApplication(reference, email);
  if (!app) return null;
  const ctx = await screeningContext(app);
  return {
    open: ctx.open,
    questions: ctx.open
      ? ctx.unanswered.map((q) => ({
          id: q.id,
          question: q.question,
          answer_type: q.answer_type ?? "text",
          required: q.required === true,
          why_asked: q.why_asked?.trim() || null,
        }))
      : [],
    reason: ctx.reason,
  };
}

type ReviewState = {
  id: string;
  organization_id: string | null;
  position_id: string | null;
  candidate_profile_id: string | null;
  admin_status: string | null;
  current_score_run_id: string | null;
  approved_score_run_id: string | null;
  current_run_method: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** The match's review state; throws when it cannot be read (fail safe). */
async function matchReviewState(db: Db, applicationId: string): Promise<ReviewState | null> {
  const { data: match, error } = await db
    .from("candidate_matches")
    .select(
      "id,organization_id,position_id,candidate_profile_id,admin_status,current_score_run_id,approved_score_run_id",
    )
    .eq("application_id", applicationId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "match_lookup_failed");
  if (!match) return null;
  let method: string | null = null;
  if (match.current_score_run_id) {
    const { data: run, error: runErr } = await db
      .from("score_runs")
      .select("evaluation_method")
      .eq("id", match.current_score_run_id)
      .maybeSingle();
    if (runErr) throw new Error(runErr.message ?? "score_run_lookup_failed");
    method = (run?.evaluation_method as string | null) ?? null;
  }
  return { ...(match as Omit<ReviewState, "current_run_method">), current_run_method: method };
}

/** One open re-review task per match (reused when one is already open). */
async function openReReviewTask(
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
  },
): Promise<{ ok: boolean; error: string | null }> {
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
    if (!openErr && (open ?? []).length > 0) return { ok: true, error: null };
  }
  const task = screeningReReviewTask({
    reason: args.reason,
    candidateName: args.candidateName,
    positionTitle: args.positionTitle,
    answeredCount: args.questionIds.length,
    dealbreakers: args.dealbreakers.map((q) => q.question),
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
    },
  });
  if (error) return { ok: false, error: error.message ?? "task_insert_failed" };
  return { ok: true, error: null };
}

const SAVE_FAILED = "We couldn't save your answers just now. Please try again in a moment.";

export async function answerScreeningByReference(input: {
  reference: string;
  email: string;
  answers: LateAnswerInput[];
}): Promise<{ ok: boolean; message: string }> {
  const app = await findApplication(input.reference, input.email);
  if (!app) return { ok: false, message: "We couldn't match that reference and email." };
  const ctx = await screeningContext(app);
  if (!ctx.open) {
    return {
      ok: false,
      message: ctx.reason ?? "There are no questions waiting for you on this application.",
    };
  }
  const prepared = prepareLateAnswers(ctx.unanswered, input.answers);
  if (!prepared.ok) return prepared;

  const db = await admin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = app as any;
  const applicationId = row.id as string;

  // Read the score's review state BEFORE storing anything: if it cannot be
  // read we cannot tell whether a rescore is allowed, so nothing is stored.
  let review: ReviewState | null;
  try {
    review = await matchReviewState(db, applicationId);
  } catch (err) {
    console.error(
      "[screening-answers] review state lookup failed",
      applicationId,
      (err as Error)?.message,
    );
    return { ok: false, message: SAVE_FAILED };
  }

  const rows = prepared.rows.map((r) => ({
    application_id: applicationId,
    question_id: r.question_id,
    answer: { value: r.value },
  }));
  // ignoreDuplicates: a row that appeared since the form loaded (a second tab,
  // staff entry) wins — a stored answer is never replaced from here.
  const { error } = await db
    .from("application_answers")
    .upsert(rows, { onConflict: "application_id,question_id", ignoreDuplicates: true });
  if (error) return { ok: false, message: SAVE_FAILED };

  const questionIds = rows.map((r) => r.question_id);
  const pos = row.positions as { title?: string | null; organization_id?: string | null } | null;
  const taskArgs = {
    match: review,
    organizationId: pos?.organization_id ?? null,
    positionId: (row.position_id as string | null) ?? null,
    candidateProfileId: (row.candidate_profile_id as string | null) ?? null,
    applicationId,
    candidateName: (row.candidate_profiles?.full_name as string | null) ?? null,
    positionTitle: pos?.title ?? null,
    questionIds,
    dealbreakers: lateDealbreakerHits(ctx.all, prepared.rows),
  };

  // A reviewed or approved score is never replaced by a machine rescore.
  const block = review ? lateAnswerRescoreBlock(review) : null;
  let followUp: "rescore_queued" | "re_review_task" | "rescore_not_queued_task" | "none";
  const problems: string[] = [];
  if (block) {
    const t = await openReReviewTask(db, { ...taskArgs, reason: block });
    followUp = t.ok ? "re_review_task" : "none";
    if (!t.ok) problems.push(`task: ${t.error}`);
  } else {
    // Same durable enqueue a new application writes; the drain rescores the match.
    const { error: jobErr } = await db.from("processing_jobs").insert({
      entity_type: "application",
      entity_id: applicationId,
      job_type: "parse_and_score",
      status: "queued",
      trace_id: crypto.randomUUID(),
    });
    if (!jobErr) {
      followUp = "rescore_queued";
    } else {
      problems.push(`job: ${jobErr.message}`);
      const t = await openReReviewTask(db, { ...taskArgs, reason: "rescore_not_queued" });
      followUp = t.ok ? "rescore_not_queued_task" : "none";
      if (!t.ok) problems.push(`task: ${t.error}`);
    }
  }
  if (problems.length) {
    console.error("[screening-answers] follow-up failed", applicationId, problems.join("; "));
  }

  const { error: auditErr } = await db.from("audit_events").insert({
    entity_type: "applications",
    entity_id: applicationId,
    action: "candidate_screening_answers_public",
    after_state: {
      question_ids: questionIds,
      follow_up: followUp,
      rescore_blocked_by: block,
      ...(problems.length ? { problems } : {}),
    },
  });
  if (auditErr) {
    console.error("[screening-answers] audit insert failed", applicationId, auditErr.message);
  }

  if (followUp === "none") {
    // Stored, but neither a rescore nor a task reached the team: say so.
    return {
      ok: true,
      message: `Thanks — your answers are saved, but we could not alert the review team automatically. Please email ${DIRECT_CONTACT_EMAIL} so they know to read them.`,
    };
  }
  return { ok: true, message: "Thanks — your answers are with the review team." };
}
