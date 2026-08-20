import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate } from "@/lib/format/datetime";
/**
 * "What happens next" for one role — the answer to the question clients
 * currently ask by email.
 *
 * One milestone per role, derived from the furthest stage the role has reached
 * and from dates that are actually stored:
 *
 *   nothing delivered yet → First shortlist expected by <date>
 *   candidates delivered  → Your review — <n> candidates waiting
 *   interviewing          → Interview feedback due by <date>
 *   offer out             → Offer response expected by <date>
 *
 * A date is shown only when a date exists in the record. For the first
 * shortlist that means a commitment baseline; without one the row reads
 * "Date confirmed once sourcing starts". Nothing here is forecast, projected,
 * or expressed as a range or a confidence — a missing date stays missing.
 *
 * Pure. No DB access.
 */

export type MilestoneStage = "shortlist" | "review" | "interview_feedback" | "offer_response";

export type MilestoneInput = {
  position_id: string;
  title: string;
  /** Candidates delivered and waiting on the client's review. */
  awaiting_review: number;
  /** True once at least one candidate is in an offer. */
  has_offer: boolean;
  /** True once at least one candidate is interviewing or has interviewed. */
  has_interview: boolean;
  /** Committed first-shortlist date: baseline_at + first_shortlist_days. */
  promised_shortlist_by: string | null;
  /** When the first shortlist actually landed. */
  shortlist_delivered_at: string | null;
  /** Recorded due date for outstanding interview feedback. */
  feedback_due_at: string | null;
  /** Recorded due date for a response to the offer. */
  offer_response_due_at: string | null;
  /** Optional user count to surface (B4 fix). */
  user_count?: number;
};

export type Milestone = {
  position_id: string;
  title: string;
  stage: MilestoneStage;
  /** The milestone in plain words, including the date when one exists. */
  text: string;
  /** The date the text refers to, or null when no date is stored. */
  expected_at: string | null;
  /** True when a stored expected date is already in the past. */
  behind_schedule: boolean;
  /** Said in words, so the meaning does not depend on colour. */
  schedule_note: string | null;
  /** Optional user count for the milestone (B4 fix). */
  user_count?: number;
};

export function formatMilestoneDate(iso: string): string {
  return formatDate(Date(iso));
}

const NO_DATE_YET = "Date confirmed once sourcing starts";

function passed(iso: string | null, nowMs: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t < nowMs;
}

export function computeNextMilestone(input: MilestoneInput, now: Date = new Date()): Milestone {
  const nowMs = now.getTime();

  const build = (
    stage: MilestoneStage,
    expected_at: string | null,
    withDate: (label: string) => string,
    withoutDate: string,
  ): Milestone => {
    const valid =
      expected_at && !Number.isNaN(new Date(expected_at).getTime()) ? expected_at : null;
    const behind = passed(valid, nowMs);
    return {
      position_id: input.position_id,
      title: input.title,
      stage,
      text: valid ? withDate(formatMilestoneDate(valid)) : withoutDate,
      expected_at: valid,
      behind_schedule: behind,
      schedule_note: behind ? "behind schedule" : null,
      user_count: input.user_count,
    };
  };

  // Furthest stage first: an offer outranks interviews, which outrank a review.
  if (input.has_offer) {
    return build(
      "offer_response",
      input.offer_response_due_at,
      (d) => `Offer response expected by ${d}`,
      "Offer response expected — date not set",
    );
  }

  if (input.has_interview) {
    return build(
      "interview_feedback",
      input.feedback_due_at,
      (d) => `Interview feedback due by ${d}`,
      "Interview feedback due after the interview takes place",
    );
  }

  if (input.awaiting_review > 0) {
    const n = input.awaiting_review;
    return {
      position_id: input.position_id,
      title: input.title,
      stage: "review",
      text: `Your review — ${n} candidate${n === 1 ? "" : "s"} waiting`,
      expected_at: null,
      behind_schedule: false,
      schedule_note: null,
      user_count: input.user_count,
    };
  }

  // Nothing delivered yet. Only a stored commitment produces a date.
  return build(
    "shortlist",
    input.shortlist_delivered_at ? null : input.promised_shortlist_by,
    (d) => `First shortlist expected by ${d}`,
    NO_DATE_YET,
  );
}

export function computeNextMilestones(
  inputs: MilestoneInput[],
  now: Date = new Date(),
): Milestone[] {
  return inputs.map((i) => computeNextMilestone(i, now));
}
