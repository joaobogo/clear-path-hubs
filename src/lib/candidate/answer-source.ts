/**
 * Who gave a screening answer.
 *
 * Most answers are typed by the candidate on the apply form or the status
 * page. A recruiter can also enter answers for a candidate from another
 * channel (a call, a LinkedIn message). Those count in the score exactly like
 * the candidate's own, but they are never presented as the candidate's words:
 * every surface that shows one says a recruiter entered it and that the
 * candidate has not confirmed it yet. When the candidate later answers for
 * themselves, their answer replaces the recruiter's and the earlier entry is
 * kept as history.
 *
 * Pure: shared by the server writers and by the admin and client views.
 */

export const ANSWERED_BY = ["candidate", "recruiter_on_behalf"] as const;
export type AnsweredBy = (typeof ANSWERED_BY)[number];

/** Label on a recruiter-entered answer wherever a client can read it. */
export const RECRUITER_ANSWER_CLIENT_LABEL = "Recruiter-entered, pending candidate confirmation";

/** Label on the same answer in staff views. */
export const RECRUITER_ANSWER_STAFF_LABEL =
  "Entered by a recruiter on the candidate's behalf, pending candidate confirmation";

/** A source note has to say something a colleague can follow up. */
export const SOURCE_NOTE_MIN = 8;
export const SOURCE_NOTE_MAX = 500;

type AnswerRow = {
  answered_by?: unknown;
  candidate_confirmed_at?: unknown;
};

/** Stored value → who answered. Anything unrecognised is the candidate. */
export function answeredBy(raw: unknown): AnsweredBy {
  return raw === "recruiter_on_behalf" ? "recruiter_on_behalf" : "candidate";
}

/** A recruiter's entry the candidate has not answered for themselves yet. */
export function pendingCandidateConfirmation(row: AnswerRow | null | undefined): boolean {
  if (!row) return false;
  return answeredBy(row.answered_by) === "recruiter_on_behalf" && !row.candidate_confirmed_at;
}

/**
 * Question ids the candidate has answered themselves. A question only a
 * recruiter has answered is still open to the candidate.
 */
export function candidateAnsweredIds(
  rows: ReadonlyArray<AnswerRow & { question_id: string }>,
): string[] {
  return rows.filter((r) => !pendingCandidateConfirmation(r)).map((r) => r.question_id);
}

/** How many answers on an application still wait for the candidate. */
export function pendingConfirmationCount(rows: ReadonlyArray<AnswerRow>): number {
  return rows.filter((r) => pendingCandidateConfirmation(r)).length;
}

/** The value inside a stored answer ({ value }) or the bare value. */
function answerValue(stored: unknown): unknown {
  return stored && typeof stored === "object" && !Array.isArray(stored) && "value" in stored
    ? (stored as { value: unknown }).value
    : stored;
}

function comparable(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    return v
      .map((x) => String(x).trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join("|");
  }
  const s = String(v).replace(/\s+/g, " ").trim().toLowerCase();
  if (s === "yes") return "true";
  if (s === "no") return "false";
  return s;
}

/**
 * Whether two stored answers say different things. Case, spacing and the
 * yes/true spelling of a boolean are not a difference; anything else is.
 */
export function answerChanged(before: unknown, after: unknown): boolean {
  return comparable(answerValue(before)) !== comparable(answerValue(after));
}

/** Why a source note is not acceptable, or null when it is. */
export function sourceNoteProblem(note: unknown): string | null {
  const text = typeof note === "string" ? note.replace(/\s+/g, " ").trim() : "";
  if (text.length < SOURCE_NOTE_MIN) {
    return "Say where these answers came from (for example: phone call with the candidate, 26 Nov).";
  }
  if (text.length > SOURCE_NOTE_MAX) {
    return `Keep the source note under ${SOURCE_NOTE_MAX} characters.`;
  }
  return null;
}

/** The note as stored: one line, trimmed. */
export function cleanSourceNote(note: unknown): string {
  return typeof note === "string" ? note.replace(/\s+/g, " ").trim() : "";
}

/**
 * Whether publishing must wait for a recruiter's acknowledgement: there are
 * recruiter-entered answers the candidate has not confirmed, and nobody has
 * acknowledged them since the latest one was entered. Mirrors the database
 * check on the write that makes a match visible to the client.
 */
export function publishNeedsAcknowledgement(i: {
  /** Recruiter-entered answers the candidate has not confirmed. */
  pending: number;
  /** When the latest of them was entered or corrected. */
  latestPendingAnswerAt: string | null;
  acknowledgedAt: string | null;
}): boolean {
  if (i.pending <= 0) return false;
  if (!i.acknowledgedAt) return true;
  if (!i.latestPendingAnswerAt) return false;
  return new Date(i.acknowledgedAt).getTime() < new Date(i.latestPendingAnswerAt).getTime();
}
