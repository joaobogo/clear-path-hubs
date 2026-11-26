/**
 * A recruiter enters screening answers for a candidate, and acknowledges them
 * before the candidate is published.
 *
 * The answers come from another channel (a call, a LinkedIn message), so each
 * one is stored as recruiter-entered with a note of where it came from and who
 * typed it. They count in the score like any answer. They never overwrite an
 * answer the candidate gave themselves, and a recruiter correcting an earlier
 * entry keeps the earlier version as history.
 *
 * Publishing a candidate whose answers the candidate has not confirmed is a
 * decision made on purpose: the acknowledgement is stored on the match, and the
 * database refuses the write that makes the match visible without it
 * (tg_candidate_matches_recruiter_answers_gate).
 *
 * Nothing here approves, publishes, emails, or changes stage, review status or
 * visibility.
 */
import {
  answerChanged,
  answeredBy,
  cleanSourceNote,
  pendingCandidateConfirmation,
  publishNeedsAcknowledgement,
  sourceNoteProblem,
} from "./answer-source";
import {
  lateAnswerRescoreBlock,
  prepareLateAnswers,
  type LateAnswerInput,
  type ScreeningQuestionRow,
} from "./screening-invite";
import { matchReviewState } from "./screening-rereview.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

type StoredAnswer = {
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

const ANSWER_COLUMNS =
  "id,question_id,answer,answered_by,source_note,entered_by_user_id,candidate_confirmed_at,created_at,updated_at";

export type AnswersOnBehalfResult =
  | {
      ok: true;
      /** Answers stored for questions that had none. */
      saved: number;
      /** Earlier recruiter entries replaced by this one (the old one is kept as history). */
      corrected: number;
      /** Questions left alone because the candidate answered them personally. */
      kept_candidate_answers: number;
      /** Whether the score was recalculated, and what the match shows now. */
      rescored: boolean;
      score: number | null;
      message: string;
    }
  | { ok: false; message: string };

async function loadMatch(db: Db, matchId: string) {
  const { data, error } = await db
    .from("candidate_matches")
    .select(
      "id,application_id,position_id,organization_id,admin_status,recruiter_answers_confirmed_at,recruiter_answers_confirmed_by",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "match_lookup_failed");
  return data as {
    id: string;
    application_id: string | null;
    position_id: string | null;
    organization_id: string | null;
    admin_status: string | null;
    recruiter_answers_confirmed_at: string | null;
    recruiter_answers_confirmed_by: string | null;
  } | null;
}

export async function recordAnswersOnBehalf(
  db: Db,
  args: {
    matchId: string;
    actorUserId: string;
    sourceNote: string;
    answers: LateAnswerInput[];
  },
): Promise<AnswersOnBehalfResult> {
  const noteProblem = sourceNoteProblem(args.sourceNote);
  if (noteProblem) return { ok: false, message: noteProblem };
  const sourceNote = cleanSourceNote(args.sourceNote);

  const match = await loadMatch(db, args.matchId);
  if (!match) return { ok: false, message: "That candidate could not be found." };
  if (!match.application_id || !match.position_id) {
    return {
      ok: false,
      message:
        "This candidate has no application on the role, so there is nowhere to store answers.",
    };
  }

  const [{ data: questions, error: qErr }, { data: stored, error: aErr }] = await Promise.all([
    db
      .from("screening_questions")
      .select(
        "id,question,answer_type,required,why_asked,display_order,dealbreaker,preferred_answer",
      )
      .eq("position_id", match.position_id)
      .order("display_order", { ascending: true }),
    db
      .from("application_answers")
      .select(ANSWER_COLUMNS)
      .eq("application_id", match.application_id),
  ]);
  if (qErr || aErr) throw new Error((qErr ?? aErr)?.message ?? "screening_lookup_failed");

  const all = (questions ?? []) as ScreeningQuestionRow[];
  const byQuestion = new Map(((stored ?? []) as StoredAnswer[]).map((a) => [a.question_id, a]));
  const provided = new Set(args.answers.map((a) => a.question_id));

  // A question the candidate answered personally is never touched from here.
  const keptCandidateAnswers = all.filter((q) => {
    const row = byQuestion.get(q.id);
    return provided.has(q.id) && row && answeredBy(row.answered_by) === "candidate";
  }).length;
  const enterable = all.filter((q) => {
    if (!provided.has(q.id)) return false;
    const row = byQuestion.get(q.id);
    return !row || pendingCandidateConfirmation(row);
  });
  if (enterable.length === 0) {
    return {
      ok: false,
      message:
        keptCandidateAnswers > 0
          ? "The candidate has already answered these questions personally. Their answers are kept as they are."
          : "Enter at least one answer before saving.",
    };
  }

  // Only the questions the recruiter filled in are checked: a recruiter may
  // enter what they know and leave the rest for the candidate.
  const filled = enterable.filter((q) => {
    const v = args.answers.find((a) => a.question_id === q.id)?.value;
    return !(v == null || (typeof v === "string" && v.trim() === ""));
  });
  const prepared = prepareLateAnswers(filled, args.answers);
  if (!prepared.ok) return prepared;

  let saved = 0;
  let corrected = 0;
  const correctedIds: string[] = [];
  const savedIds: string[] = [];
  for (const row of prepared.rows) {
    const existing = byQuestion.get(row.question_id);
    const next = { value: row.value };
    if (!existing) {
      const { data: inserted, error } = await db
        .from("application_answers")
        .upsert(
          [
            {
              application_id: match.application_id,
              question_id: row.question_id,
              answer: next,
              answered_by: "recruiter_on_behalf",
              source_note: sourceNote,
              entered_by_user_id: args.actorUserId,
            },
          ],
          // A row that appeared since the form loaded (the candidate answering
          // at the same moment) wins: it is never replaced from here.
          { onConflict: "application_id,question_id", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw new Error(error.message ?? "answer_insert_failed");
      if ((inserted ?? []).length > 0) {
        saved += 1;
        savedIds.push(row.question_id);
      }
      continue;
    }
    const changed = answerChanged(existing.answer, next);
    if (!changed && (existing.source_note ?? "") === sourceNote) continue;
    const question = all.find((q) => q.id === row.question_id)?.question ?? null;
    const { error: histErr } = await db.from("application_answer_history").insert({
      application_id: match.application_id,
      question_id: row.question_id,
      question,
      answer: existing.answer,
      answered_by: "recruiter_on_behalf",
      source_note: existing.source_note,
      entered_by_user_id: existing.entered_by_user_id,
      answered_at: existing.updated_at ?? existing.created_at,
      replaced_by: "recruiter_on_behalf",
      answer_changed: changed,
    });
    if (histErr) throw new Error(histErr.message ?? "answer_history_failed");
    const { data: updated, error: updErr } = await db
      .from("application_answers")
      .update({ answer: next, source_note: sourceNote, entered_by_user_id: args.actorUserId })
      .eq("id", existing.id)
      // Still a recruiter's entry: a candidate answer that landed meanwhile stays.
      .eq("answered_by", "recruiter_on_behalf")
      .is("candidate_confirmed_at", null)
      .select("id");
    if (updErr) throw new Error(updErr.message ?? "answer_update_failed");
    if ((updated ?? []).length > 0) {
      corrected += 1;
      correctedIds.push(row.question_id);
    }
  }

  if (saved + corrected === 0) {
    return {
      ok: true,
      saved: 0,
      corrected: 0,
      kept_candidate_answers: keptCandidateAnswers,
      rescored: false,
      score: null,
      message: "Nothing changed: these answers are already on file.",
    };
  }

  const { error: auditErr } = await db.from("audit_events").insert({
    actor_user_id: args.actorUserId,
    organization_id: match.organization_id,
    entity_type: "candidate_match",
    entity_id: match.id,
    action: "recruiter_screening_answers_on_behalf",
    after_state: {
      application_id: match.application_id,
      source_note: sourceNote,
      saved_question_ids: savedIds,
      corrected_question_ids: correctedIds,
      kept_candidate_answers: keptCandidateAnswers,
    },
  });
  if (auditErr) {
    console.error("[answers-on-behalf] audit insert failed", match.id, auditErr.message);
  }

  // The same rule as a candidate's late answers: an approved score is not
  // recalculated behind the client's back. Anything else is rescored now, and
  // a recruiter's review on the match is put back on top of the new run.
  const review = await matchReviewState(db, match.application_id);
  const block = review ? lateAnswerRescoreBlock(review) : null;
  const stored_n = saved + corrected;
  const lead = `${stored_n === 1 ? "1 answer" : `${stored_n} answers`} saved as recruiter-entered.`;
  if (block) {
    return {
      ok: true,
      saved,
      corrected,
      kept_candidate_answers: keptCandidateAnswers,
      rescored: false,
      score: null,
      message: `${lead} The match is approved, so its score was not changed; re-score it from the review screen if these answers should count.`,
    };
  }
  const { executeScoring } = await import("@/lib/scoring-service.server");
  const res = await executeScoring(match.id, {
    force: true,
    reason: "Screening answers entered by a recruiter on the candidate's behalf",
    actor_user_id: args.actorUserId,
  });
  if (!res.ok) {
    return {
      ok: true,
      saved,
      corrected,
      kept_candidate_answers: keptCandidateAnswers,
      rescored: false,
      score: null,
      message: `${lead} The score could not be recalculated (${res.message}); re-score from the review screen.`,
    };
  }
  return {
    ok: true,
    saved,
    corrected,
    kept_candidate_answers: keptCandidateAnswers,
    rescored: true,
    score: res.score >= 0 ? res.score : null,
    message: `${lead} The score was recalculated.`,
  };
}

/** What the publish step needs to know about recruiter-entered answers. */
export async function recruiterAnswerPublishState(
  db: Db,
  matchId: string,
): Promise<{
  pending: number;
  latest_pending_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  needs_acknowledgement: boolean;
}> {
  const match = await loadMatch(db, matchId);
  if (!match?.application_id) {
    return {
      pending: 0,
      latest_pending_at: null,
      acknowledged_at: null,
      acknowledged_by: null,
      needs_acknowledgement: false,
    };
  }
  const { data, error } = await db
    .from("application_answers")
    .select("answered_by,candidate_confirmed_at,created_at,updated_at")
    .eq("application_id", match.application_id);
  if (error) throw new Error(error.message ?? "answer_lookup_failed");
  const pending = ((data ?? []) as StoredAnswer[]).filter((a) => pendingCandidateConfirmation(a));
  const latest =
    pending
      .map((a) => a.updated_at ?? a.created_at)
      .filter((t): t is string => !!t)
      .sort()
      .at(-1) ?? null;
  return {
    pending: pending.length,
    latest_pending_at: latest,
    acknowledged_at: match.recruiter_answers_confirmed_at,
    acknowledged_by: match.recruiter_answers_confirmed_by,
    needs_acknowledgement: publishNeedsAcknowledgement({
      pending: pending.length,
      latestPendingAnswerAt: latest,
      acknowledgedAt: match.recruiter_answers_confirmed_at,
    }),
  };
}

/**
 * The recruiter's confirm step before publishing a candidate whose screening
 * answers the candidate has not confirmed. Records who acknowledged and when.
 * It does not publish.
 */
export async function acknowledgeRecruiterAnswers(
  db: Db,
  args: { matchId: string; actorUserId: string },
): Promise<{ ok: boolean; message: string; pending: number }> {
  const state = await recruiterAnswerPublishState(db, args.matchId);
  if (state.pending === 0) {
    return {
      ok: false,
      pending: 0,
      message: "There are no recruiter-entered answers waiting for this candidate's confirmation.",
    };
  }
  // The database compares this stamp with the time of the latest entry, and
  // the two clocks can differ by a moment. The stamp is never earlier than the
  // entries the recruiter was shown, so what they acknowledged is covered and
  // anything entered afterwards is not.
  const latestMs = state.latest_pending_at ? new Date(state.latest_pending_at).getTime() : 0;
  const now = new Date(Math.max(Date.now(), latestMs + 1000)).toISOString();
  const { data: before } = await db
    .from("candidate_matches")
    .select("organization_id")
    .eq("id", args.matchId)
    .maybeSingle();
  const { error } = await db
    .from("candidate_matches")
    .update({
      recruiter_answers_confirmed_at: now,
      recruiter_answers_confirmed_by: args.actorUserId,
    })
    .eq("id", args.matchId);
  if (error) throw new Error(error.message ?? "acknowledgement_failed");
  const { error: auditErr } = await db.from("audit_events").insert({
    actor_user_id: args.actorUserId,
    organization_id: before?.organization_id ?? null,
    entity_type: "candidate_match",
    entity_id: args.matchId,
    action: "recruiter_answers_publish_acknowledged",
    after_state: { pending_answers: state.pending, acknowledged_at: now },
  });
  if (auditErr) {
    console.error("[answers-on-behalf] audit insert failed", args.matchId, auditErr.message);
  }
  return {
    ok: true,
    pending: state.pending,
    message:
      state.pending === 1
        ? "Noted: this candidate can be published with 1 recruiter-entered answer, labelled as such for the client."
        : `Noted: this candidate can be published with ${state.pending} recruiter-entered answers, labelled as such for the client.`,
  };
}
