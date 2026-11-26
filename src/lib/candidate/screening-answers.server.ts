/**
 * The candidate answers the role's screening questions on an EXISTING
 * application — for a CV that reached us by email, a staff entry made from
 * one, or an import of people who applied (screeningLinkSource). Form
 * applications and staff assignments never get the form here.
 *
 * Verified by reference + the email on the application on every call, exactly
 * like the rest of the status page (findApplication). Only questions the
 * candidate has not answered themselves are offered and stored; an answer the
 * candidate gave is never overwritten.
 *
 * A question a recruiter answered for the candidate (answer-source.ts) is
 * still the candidate's to answer. When they do, their answer replaces the
 * recruiter's, the recruiter's entry is kept as history, the answer is marked
 * as confirmed by the candidate, and staff are told which answers differ.
 *
 * What happens next depends on the score:
 *  - unreviewed match: the application is queued for parse_and_score, the
 *    same durable job a new application writes, so the scorer weighs the
 *    answers and applies the dealbreaker rule on the rescore. The job's
 *    trace_id carries the 'screening_answers:' prefix, so the drain checks the
 *    review state again when it runs and holds the rescore if staff adjusted
 *    or approved the score in the meantime (holdScreeningRescoreIfReviewed);
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
  screeningAnswersTraceId,
  screeningLinkSource,
  screeningStillOpen,
  unansweredQuestions,
  type LateAnswerInput,
  type ScreeningQuestionRow,
} from "./screening-invite";
import {
  matchReviewState,
  openChangedAnswersTask,
  openReReviewTask,
  type ReviewState,
} from "./screening-rereview.server";
import { answerChanged, candidateAnsweredIds, pendingCandidateConfirmation } from "./answer-source";
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

type StoredAnswerRow = {
  id: string;
  question_id: string;
  answer: unknown;
  answered_by: string | null;
  source_note: string | null;
  entered_by_user_id: string | null;
  candidate_confirmed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

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
      .select(
        "id,question_id,answer,answered_by,source_note,entered_by_user_id,candidate_confirmed_at,created_at,updated_at",
      )
      .eq("application_id", row.id as string),
  ]);
  if (qErr || aErr) throw new Error((qErr ?? aErr)?.message ?? "screening_lookup_failed");
  const all = (questions ?? []) as ScreeningQuestionRow[];
  const stored = (answers ?? []) as StoredAnswerRow[];
  // A recruiter's entry does not close a question: only the candidate's own
  // answer does.
  const answeredIds = candidateAnsweredIds(stored);
  const recruiterEntries = new Map(
    stored.filter((a) => pendingCandidateConfirmation(a)).map((a) => [a.question_id, a]),
  );
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
    recruiterEntries,
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
  // Questions a recruiter answered for the candidate: the candidate's answer
  // replaces the entry, and the entry is kept as history first.
  const replacing = rows.filter((r) => ctx.recruiterEntries.has(r.question_id));
  const fresh = rows.filter((r) => !ctx.recruiterEntries.has(r.question_id));
  const confirmedAt = new Date().toISOString();
  const replacedIds: string[] = [];
  const changedIds: string[] = [];
  for (const r of replacing) {
    const entry = ctx.recruiterEntries.get(r.question_id)!;
    const changed = answerChanged(entry.answer, r.answer);
    const { error: histErr } = await db.from("application_answer_history").insert({
      application_id: applicationId,
      question_id: r.question_id,
      question: ctx.all.find((q) => q.id === r.question_id)?.question ?? null,
      answer: entry.answer as never,
      answered_by: "recruiter_on_behalf",
      source_note: entry.source_note,
      entered_by_user_id: entry.entered_by_user_id,
      answered_at: entry.updated_at ?? entry.created_at,
      replaced_by: "candidate",
      answer_changed: changed,
    });
    if (histErr) return { ok: false, message: SAVE_FAILED };
    const { data: updated, error: updErr } = await db
      .from("application_answers")
      .update({
        answer: r.answer,
        answered_by: "candidate",
        source_note: null,
        entered_by_user_id: null,
        candidate_confirmed_at: confirmedAt,
      })
      .eq("id", entry.id)
      // Only a recruiter's entry is replaced; the candidate's own answer never is.
      .eq("answered_by", "recruiter_on_behalf")
      .select("id");
    if (updErr) return { ok: false, message: SAVE_FAILED };
    if ((updated ?? []).length > 0) {
      replacedIds.push(r.question_id);
      if (changed) changedIds.push(r.question_id);
    }
  }
  if (fresh.length > 0) {
    // ignoreDuplicates: a row that appeared since the form loaded (a second
    // tab, staff entry) wins — a stored answer is never replaced from here.
    const { error } = await db
      .from("application_answers")
      .upsert(fresh, { onConflict: "application_id,question_id", ignoreDuplicates: true });
    if (error) return { ok: false, message: SAVE_FAILED };
  }

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
    // Same durable enqueue a new application writes; the drain rescores the
    // match. The trace prefix makes the drain check the review state again
    // before it runs: staff may adjust or approve the score in between, and
    // the drain then cancels the job and opens the re-review task instead.
    const { error: jobErr } = await db.from("processing_jobs").insert({
      entity_type: "application",
      entity_id: applicationId,
      job_type: "parse_and_score",
      status: "queued",
      trace_id: screeningAnswersTraceId(crypto.randomUUID()),
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
  // The candidate's answer differs from the recruiter's entry: say which.
  if (changedIds.length > 0) {
    const changed = ctx.all.filter((q) => changedIds.includes(q.id));
    const t = await openChangedAnswersTask(db, {
      match: review,
      organizationId: taskArgs.organizationId,
      positionId: taskArgs.positionId,
      candidateProfileId: taskArgs.candidateProfileId,
      applicationId,
      candidateName: taskArgs.candidateName,
      positionTitle: taskArgs.positionTitle,
      changed,
      dealbreakers: taskArgs.dealbreakers.filter((q) => changedIds.includes(q.id)),
    });
    if (!t.ok) problems.push(`changed-answers task: ${t.error}`);
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
      ...(replacedIds.length
        ? {
            replaced_recruiter_answer_question_ids: replacedIds,
            changed_from_recruiter_question_ids: changedIds,
          }
        : {}),
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
