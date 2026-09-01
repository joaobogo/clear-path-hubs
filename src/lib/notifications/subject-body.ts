/**
 * Naming the record a staff notification is about.
 *
 * Three "CV parsing failed — A CV could not be parsed and needs attention"
 * items sat on the admin feed, none naming its document, over a parse-failure
 * queue listing one CV and a Pipeline Health tile reporting two unprocessed.
 * The operator saw three identical tasks, a queue of one and a tile of two,
 * with no way to tell whether that was one document failing repeatedly or
 * three documents (audit 1 Sep, F40).
 *
 * It was three documents. Emit idempotency is `pipeline:<match>:cv_parse_failed`,
 * one per candidate match — so the feed was accurate and unreadable at the same
 * time, because the tier rule's `affects` is a static class string ("One
 * application document") and nothing ever carried the subject through.
 *
 * Browser-safe: pure functions only, so the guard test can exercise the
 * audience rule without a database.
 */

import type { Audience } from "@/lib/events";

/**
 * Audiences that may see a named subject.
 *
 * Staff only. Client- and candidate-facing copy never names an individual —
 * a rule the event catalogue has carried since it was written, and the reason
 * `cv_parse_failed` is withheld from client feeds outright. Widening this set
 * is how that rule would be lost, so it lives here with the function that
 * applies it and is asserted directly by the guard test.
 */
const NAMED_SUBJECT_AUDIENCES: readonly string[] = ["admin"];

export function audienceMaySeeSubject(audience: Audience | string | null | undefined): boolean {
  return NAMED_SUBJECT_AUDIENCES.includes(String(audience ?? ""));
}

/**
 * The notification body, with the subject named when the reader may see it.
 *
 * Returns the body unchanged for every other audience, and when there is no
 * subject to name — so a caller that passes nothing gets exactly the previous
 * behaviour.
 */
export function subjectBody(
  audience: Audience | string | null | undefined,
  body: string | null,
  subjectLabel: string | null | undefined,
): string | null {
  const subject = (subjectLabel ?? "").trim();
  if (!subject || !audienceMaySeeSubject(audience)) return body;
  const text = (body ?? "").trim();
  if (!text) return subject;
  // Already named — a caller that built the subject into its own body must not
  // get it twice.
  if (text.toLowerCase().includes(subject.toLowerCase())) return text;
  return `${subject} — ${text}`;
}

/**
 * "GGM, attempt 6 of 6" — a repeated failure on one entity, counted.
 *
 * The feed showed a bare repeat with no attempt number, so a document on its
 * sixth extraction attempt was indistinguishable from one on its first.
 */
export function attemptLabel(
  name: string | null | undefined,
  attempt: number | null | undefined,
  maxAttempts: number | null | undefined,
): string | null {
  const who = (name ?? "").trim();
  if (!who) return null;
  if (!Number.isFinite(attempt) || (attempt as number) < 1) return who;
  return Number.isFinite(maxAttempts) && (maxAttempts as number) >= (attempt as number)
    ? `${who}, attempt ${attempt} of ${maxAttempts}`
    : `${who}, attempt ${attempt}`;
}
