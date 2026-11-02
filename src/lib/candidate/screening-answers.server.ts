/**
 * The candidate answers the role's screening questions on an EXISTING
 * application — for a CV that reached us by email, an admin assignment or an
 * import, none of which showed the apply form.
 *
 * Verified by reference + the email on the application on every call, exactly
 * like the rest of the status page (findApplication). Only unanswered
 * questions are offered and stored; a stored answer is never overwritten.
 * The answers go to application_answers and the application is queued for
 * parse_and_score, the same durable job a new application writes, so the
 * scorer weighs them and applies the dealbreaker rule on the rescore. Nothing
 * here approves, publishes, or changes stage, review status or visibility.
 */
import { findApplication } from "./apply-status.server";
import {
  SCREENING_OPEN_POSITION_STATUSES,
  applicationIsClosed,
  prepareLateAnswers,
  screeningStillOpen,
  unansweredQuestions,
  type LateAnswerInput,
  type ScreeningQuestionRow,
} from "./screening-invite";

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
      .select("id,question,answer_type,required,why_asked,display_order")
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
  const pending = screeningStillOpen(all, answeredIds);
  return {
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
  const applicationId = (app as any).id as string;
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
  if (error) {
    return {
      ok: false,
      message: "We couldn't save your answers just now. Please try again in a moment.",
    };
  }

  // Same durable enqueue a new application writes; the drain rescores the match.
  await db.from("processing_jobs").insert({
    entity_type: "application",
    entity_id: applicationId,
    job_type: "parse_and_score",
    status: "queued",
    trace_id: crypto.randomUUID(),
  });
  await db.from("audit_events").insert({
    entity_type: "applications",
    entity_id: applicationId,
    action: "candidate_screening_answers_public",
    after_state: { question_ids: rows.map((r) => r.question_id) },
  });
  return { ok: true, message: "Thanks — your answers are with the review team." };
}
