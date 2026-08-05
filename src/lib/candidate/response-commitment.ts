/**
 * The single source of truth for what we tell an applicant will happen after
 * they submit, and when. Every surface (confirmation page, confirmation email,
 * status page) reads from here so the platform never states two windows.
 *
 * These are commitments we keep — a review window and a contact method. None of
 * them promise an interview, a shortlist, or any outcome.
 */

/** Business days within which an application is reviewed. */
export const REVIEW_WINDOW_BUSINESS_DAYS = 5;

/** Plain-English window, used in body copy. */
export const REVIEW_WINDOW_SENTENCE =
  "Most applications are reviewed within five business days.";

/** How we contact applicants — the only channel we commit to. */
export const CONTACT_METHOD_SENTENCE =
  "We contact you by email, at the address on your application. Everything we send includes your reference.";

/** Email-friendly single paragraph combining window + channel. */
export const REVIEW_WINDOW_EMAIL_LINE =
  "Most applications are reviewed within five business days. That is our review commitment, not a promise of an interview — either way you hear from us by email.";

export type NextStep = { title: string; detail: string };

/**
 * Three steps, in order, describing only work we actually do.
 */
export const APPLICATION_NEXT_STEPS: NextStep[] = [
  {
    title: "Your CV is prepared for review",
    detail:
      "We read your CV and answers and pull out the experience that relates to this role, so a reviewer sees the evidence rather than a guess.",
  },
  {
    title: "A person reviews your application",
    detail: `A member of our review team reads it and decides what to share with the employer. ${REVIEW_WINDOW_SENTENCE}`,
  },
  {
    title: "We email you the outcome",
    detail:
      "You hear from us either way — whether that is a next step, a question we need answered, or a no. If the employer takes longer, we still write to tell you where things stand.",
  },
];

/** Reference shown to candidates, derived from the application id. */
export function applicationReference(applicationId: string): string {
  return applicationId.replace(/-/g, "").slice(0, 6).toUpperCase();
}
