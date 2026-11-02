/**
 * Screening questions for applications that never went through the apply form.
 *
 * Owner item 6b (2 Nov 2026): a CV sent straight to the team by email (Adiya,
 * Hughes Mushrooms) became an application with no screening answers, because
 * only the public form asks the role's questions. The candidate now answers
 * them on the status page (reference + email), and an application that
 * arrived without the form gets one email with that link.
 *
 * Pure rules only — shared by the candidate flow, the automatic sweep and the
 * staff button so all three agree on what "still has questions to answer"
 * means. Answers never decide anything here: eligibility stays with the
 * dealbreaker rule the scorer applies when the match is rescored.
 */
import { SCREENING_ANSWER_MAX } from "@/lib/screening-limits";

/** Staff entering a record get this long to add answers before we email. */
export const SCREENING_INVITE_GRACE_MS = 15 * 60_000;
/** An undecided row older than this is never emailed automatically. */
export const SCREENING_INVITE_WINDOW_MS = 7 * 24 * 60 * 60_000;

/** Role statuses in which a candidate may still change their application. */
export const SCREENING_OPEN_POSITION_STATUSES: readonly string[] = ["active", "approved", "paused"];
const CLOSED_APPLICATION_STATUSES: readonly string[] = ["withdrawn", "rejected", "archived"];

/** Marker the migration gives every application that existed before invites. */
export const SCREENING_INVITE_PREDATES = "predates_feature";

export type ScreeningQuestionRow = {
  id: string;
  question: string;
  answer_type: string | null;
  required: boolean | null;
  why_asked?: string | null;
  display_order?: number | null;
};

export type InviteApplication = {
  created_at: string;
  status: string | null;
  withdrawn_at: string | null;
  is_test_record?: boolean | null;
  source?: string | null;
  source_channel?: string | null;
  consent?: unknown;
  screening_invite_status?: string | null;
};

/**
 * True when the candidate filled in the public apply form. The form writes
 * source_channel 'public_job_board' and stamps the question revision it showed
 * into consent; staff entries, admin assignments and imports do neither.
 */
export function cameThroughApplyForm(
  app: Pick<InviteApplication, "source" | "source_channel" | "consent">,
): boolean {
  if ((app.source_channel ?? "").trim() === "public_job_board") return true;
  if ((app.source ?? "").startsWith("public_job_board:")) return true;
  const consent = app.consent;
  return (
    !!consent &&
    typeof consent === "object" &&
    typeof (consent as Record<string, unknown>).question_version === "number"
  );
}

export function applicationIsClosed(
  app: Pick<InviteApplication, "status" | "withdrawn_at">,
): boolean {
  return Boolean(app.withdrawn_at) || CLOSED_APPLICATION_STATUSES.includes(app.status ?? "");
}

/** The role's questions this application has no answer to, in display order. */
export function unansweredQuestions<Q extends ScreeningQuestionRow>(
  questions: readonly Q[],
  answeredIds: Iterable<string>,
): Q[] {
  const answered = new Set(answeredIds);
  return questions
    .filter((q) => !answered.has(q.id))
    .slice()
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

/**
 * Whether the candidate still has screening to do: a required question is
 * unanswered, or the role asks questions and none has been answered yet. A
 * candidate who answered the required ones and skipped an optional one is
 * done — the form does not come back to nag them.
 */
export function screeningStillOpen(
  questions: readonly ScreeningQuestionRow[],
  answeredIds: Iterable<string>,
): boolean {
  const answered = new Set(answeredIds);
  if (questions.length === 0) return false;
  const answeredHere = questions.filter((q) => answered.has(q.id)).length;
  if (answeredHere === 0) return true;
  return questions.some((q) => q.required === true && !answered.has(q.id));
}

export type AutomaticInviteDecision =
  | { action: "send" }
  | { action: "wait" }
  | {
      action: "skip";
      reason:
        | "predates_feature"
        | "already_decided"
        | "test_record"
        | "form_application"
        | "application_closed"
        | "outside_window"
        | "no_questions"
        | "already_answered"
        | "no_email";
    };

/**
 * The automatic invitation: once, only for an application created after the
 * feature shipped (its marker is still NULL), that arrived without the form,
 * has zero answers while its role has questions, and is still open.
 */
export function decideAutomaticInvite(i: {
  app: InviteApplication;
  questionCount: number;
  answerCount: number;
  hasEmail: boolean;
  now?: Date;
}): AutomaticInviteDecision {
  const marker = i.app.screening_invite_status ?? null;
  if (marker === SCREENING_INVITE_PREDATES) return { action: "skip", reason: "predates_feature" };
  if (marker !== null) return { action: "skip", reason: "already_decided" };
  if (i.app.is_test_record) return { action: "skip", reason: "test_record" };
  if (cameThroughApplyForm(i.app)) return { action: "skip", reason: "form_application" };
  if (applicationIsClosed(i.app)) return { action: "skip", reason: "application_closed" };

  const age = (i.now ?? new Date()).getTime() - new Date(i.app.created_at).getTime();
  if (!(age >= SCREENING_INVITE_GRACE_MS)) return { action: "wait" };
  if (age > SCREENING_INVITE_WINDOW_MS) return { action: "skip", reason: "outside_window" };

  if (i.questionCount === 0) return { action: "skip", reason: "no_questions" };
  if (i.answerCount > 0) return { action: "skip", reason: "already_answered" };
  if (!i.hasEmail) return { action: "skip", reason: "no_email" };
  return { action: "send" };
}

export type StaffInviteDecision = { ok: true } | { ok: false; message: string };

/**
 * The staff button: works on any application, old or new, form or not, as
 * long as the candidate would find questions to answer behind the link.
 */
export function decideStaffInvite(i: {
  app: Pick<InviteApplication, "status" | "withdrawn_at">;
  positionStatus: string | null;
  questions: readonly ScreeningQuestionRow[];
  answeredIds: Iterable<string>;
  hasEmail: boolean;
}): StaffInviteDecision {
  if (applicationIsClosed(i.app)) {
    return {
      ok: false,
      message: "This application is closed, so there is nothing for the candidate to answer.",
    };
  }
  if (!SCREENING_OPEN_POSITION_STATUSES.includes(i.positionStatus ?? "")) {
    return {
      ok: false,
      message: "The role is not open, so its questions can no longer be answered.",
    };
  }
  if (i.questions.length === 0) {
    return { ok: false, message: "This role has no screening questions." };
  }
  if (!screeningStillOpen(i.questions, i.answeredIds)) {
    return {
      ok: false,
      message: "The candidate has already answered this role's screening questions.",
    };
  }
  if (!i.hasEmail) {
    return { ok: false, message: "There is no email address on this candidate's profile." };
  }
  return { ok: true };
}

export type LateAnswerValue = string | boolean | number | string[] | null;
export type LateAnswerInput = { question_id: string; value: LateAnswerValue };
export type PreparedLateAnswers =
  | { ok: true; rows: Array<{ question_id: string; value: Exclude<LateAnswerValue, null> }> }
  | { ok: false; message: string };

function isBlank(v: LateAnswerValue | undefined): boolean {
  return (
    v == null ||
    (typeof v === "string" && v.trim() === "") ||
    (Array.isArray(v) && v.every((x) => String(x).trim() === ""))
  );
}

function normalise(
  q: ScreeningQuestionRow,
  v: Exclude<LateAnswerValue, null>,
): { ok: true; value: Exclude<LateAnswerValue, null> } | { ok: false } {
  const type = q.answer_type ?? "text";
  if (type === "boolean") {
    if (typeof v === "boolean") return { ok: true, value: v };
    const s = String(v).trim().toLowerCase();
    if (s === "yes" || s === "true") return { ok: true, value: true };
    if (s === "no" || s === "false") return { ok: true, value: false };
    return { ok: false };
  }
  if (type === "number") {
    const n = typeof v === "number" ? v : Number(String(v).trim());
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
  }
  if (type === "multi_choice") {
    const list = (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean);
    if (list.some((x) => x.length > SCREENING_ANSWER_MAX)) return { ok: false };
    return { ok: true, value: list };
  }
  const text = (Array.isArray(v) ? v.join(", ") : String(v)).trim();
  if (text.length > SCREENING_ANSWER_MAX) return { ok: false };
  return { ok: true, value: text };
}

/**
 * Validates a late submission against the questions still unanswered. Answers
 * to anything else (already answered, another role) are dropped, so a stored
 * answer is never overwritten. Required questions must be answered, exactly as
 * on the apply form; optional ones may be skipped.
 */
export function prepareLateAnswers(
  open: readonly ScreeningQuestionRow[],
  input: readonly LateAnswerInput[],
): PreparedLateAnswers {
  const byId = new Map(input.map((a) => [a.question_id, a.value]));
  const rows: Array<{ question_id: string; value: Exclude<LateAnswerValue, null> }> = [];
  for (const q of open) {
    const raw = byId.get(q.id);
    if (isBlank(raw)) {
      if (q.required) {
        return {
          ok: false,
          message: `Please answer the required screening question: "${q.question}"`,
        };
      }
      continue;
    }
    const n = normalise(q, raw as Exclude<LateAnswerValue, null>);
    if (!n.ok) {
      const hint =
        q.answer_type === "boolean"
          ? "Choose yes or no"
          : q.answer_type === "number"
            ? "Enter a number"
            : `Keep it under ${SCREENING_ANSWER_MAX.toLocaleString("en-GB")} characters`;
      return { ok: false, message: `${hint} for: "${q.question}"` };
    }
    rows.push({ question_id: q.id, value: n.value });
  }
  if (rows.length === 0)
    return { ok: false, message: "Answer at least one question before sending." };
  return { ok: true, rows };
}

/** The 6-character reference the candidate already uses on the status page. */
export function applicationReference(applicationId: string): string {
  return applicationId.replace(/-/g, "").slice(0, 6).toUpperCase();
}
