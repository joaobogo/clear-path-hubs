/**
 * Canonical limits and legality rules for role screening questions.
 *
 * A question earns its place only when the answer changes a decision, so the
 * set is capped at five, every question states the must-have it maps to and
 * why it is being asked, and free-text answers are short by design.
 * Protected-characteristic questions are rejected outright — accommodation
 * needs are collected separately, never as screening.
 */
export const SCREENING_MAX_QUESTIONS = 5;
export const SCREENING_MAX_REQUIRED = 4;
/** Free-text screening answers are capped: short answers, not essays. */
export const SCREENING_ANSWER_MAX = 300;

export function countRequired(qs: { required?: boolean }[]): number {
  return qs.filter((q) => q.required).length;
}

/** Protected characteristics and the usual proxies for them. */
const PROHIBITED_PATTERNS: { re: RegExp; topic: string }[] = [
  { re: /how old are you|your age|date of birth|birth ?date|year (were|was) you born/i, topic: "age" },
  {
    re: /nationality|citizen(ship)? of|citizenship|ethnic|\brace\b|birthplace|country of birth|native language/i,
    topic: "nationality or ethnicity",
  },
  {
    re: /marital status|are you married|husband|wife|spouse|do you have (any )?(children|kids)|pregnan|planning a family|childcare arrangements/i,
    topic: "marital or family status",
  },
  {
    re: /health condition|medical history|disabilit|chronic illness|mental health|sick days|do you smoke/i,
    topic: "health or disability",
  },
  { re: /religio|which church|attend (church|mosque|synagogue)|\bcaste\b/i, topic: "religion" },
  {
    re: /accommodation needs|reasonable adjustment|special needs/i,
    topic: "accommodation needs (collected separately, never as screening)",
  },
];

/** Returns a message when the question text touches a prohibited topic. */
export function screeningTopicIssue(question: string): string | null {
  const hit = PROHIBITED_PATTERNS.find((p) => p.re.test(question));
  return hit
    ? `This question asks about ${hit.topic}. Screening questions may not cover protected characteristics — ask about the must-have skill or requirement instead.`
    : null;
}

export type ScreeningRuleInput = {
  question: string;
  required?: boolean;
  why_asked?: string | null;
  must_have?: string | null;
};

/** Returns an error message when the set breaks the rules, otherwise null. */
export function validateScreeningSet(qs: ScreeningRuleInput[]): string | null {
  if (qs.length > SCREENING_MAX_QUESTIONS) {
    return `Keep it to ${SCREENING_MAX_QUESTIONS} screening questions or fewer — each one costs completions.`;
  }
  if (countRequired(qs) > SCREENING_MAX_REQUIRED) {
    return `At most ${SCREENING_MAX_REQUIRED} screening questions can be mandatory — make the rest optional.`;
  }
  for (const q of qs) {
    const topic = screeningTopicIssue(q.question ?? "");
    if (topic) return topic;
    if (!(q.must_have ?? "").trim()) {
      return `"${(q.question ?? "").slice(0, 60)}" is not tied to a must-have on the brief. Link it or remove it.`;
    }
    if (!(q.why_asked ?? "").trim()) {
      return `"${(q.question ?? "").slice(0, 60)}" needs a one-line reason candidates can read.`;
    }
  }
  return null;
}
