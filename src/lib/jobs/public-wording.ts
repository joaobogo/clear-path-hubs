/**
 * Wording a recruiter sets for one role's public job page.
 *
 * The page derives most of its lines from structured fields (work model,
 * location, pay range, the organisation's name). Some roles do not fit those
 * fields: a field-based sales role is neither remote, hybrid nor on-site; a
 * territory is not a location; a confidential client may still be described.
 * These five settings let the role say so in its own words. They live beside
 * the other job-post copy in positions.intake_context.posting, and an empty
 * value always means "use the derived line".
 */

/** Keys stored in intake_context.posting. */
export const PUBLIC_WORDING_KEYS = [
  "headline",
  "work_arrangement",
  "location_line",
  "employer_label",
  "response_times",
] as const;
export type PublicWordingKey = (typeof PUBLIC_WORDING_KEYS)[number];

/** Longest value each setting may hold. */
export const PUBLIC_WORDING_MAX = {
  headline: 240,
  work_arrangement: 200,
  location_line: 200,
  employer_label: 120,
  response_times: 12,
} as const satisfies Record<PublicWordingKey, number>;

/** `response_times` value that leaves response-time promises off the page. */
export const RESPONSE_TIMES_HIDDEN = "hidden";

/** One line of text: trimmed, whitespace collapsed; anything else is empty. */
export function wordingText(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
}

export function responseTimesHidden(raw: unknown): boolean {
  return wordingText(raw).toLowerCase() === RESPONSE_TIMES_HIDDEN;
}

/** Longest first sentence that still reads as a tag beside the title. */
const ARRANGEMENT_LABEL_MAX = 40;

/**
 * A short tag for a work-arrangement statement: its first sentence, when that
 * is short enough to sit beside "Full Time" and "Director" ("Field-based in
 * London"). A longer first sentence gives no tag; the full statement is in
 * the facts block either way.
 */
export function arrangementLabel(statement: unknown): string {
  const text = wordingText(statement);
  if (!text) return "";
  const first = text
    .split(/(?<=[.!?])\s+/)[0]
    .replace(/[.!?]+$/, "")
    .trim();
  return first.length > 0 && first.length <= ARRANGEMENT_LABEL_MAX ? first : "";
}

/**
 * The employer as a job-page title or link preview names it: the label
 * without a trailing bracketed aside ("An AI-first engineering firm (name
 * shared after screening)" → "An AI-first engineering firm").
 */
export function employerLabelForTitle(label: unknown): string {
  return wordingText(label)
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}
