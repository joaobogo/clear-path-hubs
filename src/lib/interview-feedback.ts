/**
 * Two-minute interview feedback — pure types, labels, validation and draft keys.
 *
 * Deliberately short: a recommendation, a couple of lines on strengths and
 * concerns, and the next step. No 1-10 rating grid, no competency matrix, no
 * mandatory long-form review — those are what stopped feedback arriving at all.
 */

export type FeedbackRecommendation = "advance" | "hold" | "decline";
export type FeedbackNextStep = "another_interview" | "make_offer" | "stop_here";

export const RECOMMENDATION_OPTIONS: {
  value: FeedbackRecommendation;
  label: string;
  hint: string;
}[] = [
  { value: "advance", label: "Advance", hint: "Good enough to keep going" },
  { value: "hold", label: "Hold", hint: "Keep warm while we see others" },
  { value: "decline", label: "Decline", hint: "Not right for this role" },
];

export const NEXT_STEP_OPTIONS: {
  value: FeedbackNextStep;
  label: string;
  hint: string;
}[] = [
  { value: "another_interview", label: "Another interview", hint: "One more round" },
  { value: "make_offer", label: "Make an offer", hint: "We prepare the offer" },
  { value: "stop_here", label: "Stop here", hint: "We close the candidate out" },
];

export const FEEDBACK_RECOMMENDATION_LABEL: Record<FeedbackRecommendation, string> = {
  advance: "Advance",
  hold: "Hold",
  decline: "Decline",
};

export const FEEDBACK_NEXT_STEP_LABEL: Record<FeedbackNextStep, string> = {
  another_interview: "Another interview",
  make_offer: "Make an offer",
  stop_here: "Stop here",
};

/** Fixed limits, shared by the form and the server validator. */
export const FEEDBACK_TEXT_MAX = 600;
export const DECLINE_CONCERN_MIN = 10;

export type InterviewFeedbackDraft = {
  recommendation: FeedbackRecommendation | null;
  strengths: string;
  concerns: string;
  next_step: FeedbackNextStep | null;
};

export function emptyFeedbackDraft(): InterviewFeedbackDraft {
  return { recommendation: null, strengths: "", concerns: "", next_step: null };
}

export type FeedbackErrors = Partial<Record<keyof InterviewFeedbackDraft, string>>;

/** Same rules client- and server-side, so nothing passes one and fails the other. */
export function validateFeedback(draft: InterviewFeedbackDraft): FeedbackErrors {
  const errors: FeedbackErrors = {};
  if (!draft.recommendation) errors.recommendation = "Pick a recommendation.";
  if (!draft.next_step) errors.next_step = "Pick the next step.";
  if (draft.recommendation === "decline" && draft.concerns.trim().length < DECLINE_CONCERN_MIN) {
    errors.concerns = `Add at least ${DECLINE_CONCERN_MIN} characters on what concerned you.`;
  }
  if (draft.strengths.length > FEEDBACK_TEXT_MAX) {
    errors.strengths = `Keep this under ${FEEDBACK_TEXT_MAX} characters.`;
  }
  if (draft.concerns.length > FEEDBACK_TEXT_MAX) {
    errors.concerns = `Keep this under ${FEEDBACK_TEXT_MAX} characters.`;
  }
  return errors;
}

export function isFeedbackValid(draft: InterviewFeedbackDraft): boolean {
  return Object.keys(validateFeedback(draft)).length === 0;
}

/** Local draft key — a half-written form survives a refresh. */
export function draftStorageKey(interviewId: string): string {
  return `taas.interview-feedback.${interviewId}`;
}

export function readLocalDraft(interviewId: string): InterviewFeedbackDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftStorageKey(interviewId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InterviewFeedbackDraft>;
    return {
      recommendation:
        parsed.recommendation === "advance" ||
        parsed.recommendation === "hold" ||
        parsed.recommendation === "decline"
          ? parsed.recommendation
          : null,
      strengths: typeof parsed.strengths === "string" ? parsed.strengths : "",
      concerns: typeof parsed.concerns === "string" ? parsed.concerns : "",
      next_step:
        parsed.next_step === "another_interview" ||
        parsed.next_step === "make_offer" ||
        parsed.next_step === "stop_here"
          ? parsed.next_step
          : null,
    };
  } catch {
    return null;
  }
}

export function writeLocalDraft(interviewId: string, draft: InterviewFeedbackDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftStorageKey(interviewId), JSON.stringify(draft));
  } catch {
    /* storage full or blocked — the in-memory form still works */
  }
}

export function clearLocalDraft(interviewId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftStorageKey(interviewId));
  } catch {
    /* ignore */
  }
}

/** One line for lists and the recruiting-team view. */
export function feedbackHeadline(
  recommendation: FeedbackRecommendation,
  nextStep: FeedbackNextStep,
): string {
  return `${FEEDBACK_RECOMMENDATION_LABEL[recommendation]} · ${FEEDBACK_NEXT_STEP_LABEL[nextStep]}`;
}
