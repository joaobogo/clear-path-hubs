/**
 * Canonical limits for role screening questions.
 * Keep application friction low: a short question set, only a few mandatory.
 */
export const SCREENING_MAX_QUESTIONS = 8;
export const SCREENING_MAX_REQUIRED = 4;

export function countRequired(qs: { required?: boolean }[]): number {
  return qs.filter((q) => q.required).length;
}

/** Returns an error message when the set breaks the limits, otherwise null. */
export function validateScreeningSet(qs: { required?: boolean }[]): string | null {
  if (qs.length > SCREENING_MAX_QUESTIONS) {
    return `Keep it to ${SCREENING_MAX_QUESTIONS} screening questions or fewer.`;
  }
  if (countRequired(qs) > SCREENING_MAX_REQUIRED) {
    return `At most ${SCREENING_MAX_REQUIRED} screening questions can be mandatory — make the rest optional.`;
  }
  return null;
}
