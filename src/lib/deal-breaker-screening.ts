/**
 * Screening deal-breakers against protected characteristics.
 *
 * The intake field states a policy in its own helper text:
 *
 *   "Keep these about the work: experience, credentials, availability, notice
 *    or location. Anything tied to age, sex, race, religion, disability,
 *    pregnancy or another protected characteristic is removed before sourcing."
 *
 * Nothing enforced it. Entries were stored verbatim and the final review screen
 * rendered them back as accepted rules — a saved draft carried "no citizenship"
 * and the client had every reason to read that as "this will be applied"
 * (audit 1 Sep, F12). A promise made at the point of entry has to be kept at
 * the point of entry, or not made there.
 *
 * Three deliberate choices:
 *
 * 1. NON-BLOCKING. A false positive must never stop a client submitting a role.
 *    This flags and explains; it does not reject.
 * 2. The text is KEPT, not silently dropped. A client who typed something needs
 *    to see what happened to it, and a rule quietly deleted is worse than one
 *    visibly excluded.
 * 3. Work-authorisation phrasing is exempt. "Must have the right to work
 *    without sponsorship" is a lawful requirement the form already asks about
 *    separately; catching it would train clients to ignore the warning.
 *
 * This is a product safeguard, not legal advice, and the term list is not a
 * legal test. It should be reviewed by someone qualified.
 */

export type ProtectedCharacteristic =
  | "age"
  | "sex or gender"
  | "race or ethnicity"
  | "religion"
  | "disability"
  | "pregnancy or family status"
  | "nationality or citizenship"
  | "sexual orientation"
  | "marital status";

type Rule = { characteristic: ProtectedCharacteristic; pattern: RegExp };

/**
 * Word-bounded so ordinary words are not caught: "age" must not fire on
 * "agency" or "manage", "race" not on "racing", "sex" not inside another word.
 */
const RULES: Rule[] = [
  { characteristic: "age", pattern: /\b(age|aged|ageing|young|younger|youthful|old|older|elderly|mature|under \d{2}|over \d{2}|\d{2}\+? years old|digital native)\b/i },
  { characteristic: "sex or gender", pattern: /\b(sex|gender|male|female|man|men|woman|women|transgender|trans)\b/i },
  { characteristic: "race or ethnicity", pattern: /\b(race|racial|ethnic|ethnicity|colou?r of skin|caucasian|asian|black|white|hispanic|latino)\b/i },
  { characteristic: "religion", pattern: /\b(religion|religious|faith|christian|muslim|islam|jewish|hindu|buddhist|catholic|atheist)\b/i },
  { characteristic: "disability", pattern: /\b(disabled|disability|disabilities|handicap|handicapped|impairment|wheelchair|neurodiverg\w*|autis\w+|adhd)\b/i },
  { characteristic: "pregnancy or family status", pattern: /\b(pregnan\w+|maternity|paternity|childcare|children|kids|family status|parental leave)\b/i },
  { characteristic: "nationality or citizenship", pattern: /\b(citizen|citizenship|nationality|national origin|passport holder|native speaker|native english|native-level)\b/i },
  { characteristic: "sexual orientation", pattern: /\b(sexual orientation|gay|lesbian|bisexual|lgbt\w*|straight)\b/i },
  { characteristic: "marital status", pattern: /\b(married|unmarried|marital|single|divorced|spouse)\b/i },
];

/**
 * Lawful work-authorisation phrasing. The intake form asks about visa
 * sponsorship in its own question, so a deal-breaker written this way is the
 * client using the right concept in the wrong box — not a protected-
 * characteristic filter. Flagging it would teach clients to dismiss the
 * warning, which is how a safeguard stops working.
 */
const WORK_AUTHORISATION = /\b(right to work|authoris(ed|ation) to work|authoriz(ed|ation) to work|work permit|work visa|visa|sponsorship|sponsor|eligible to work|legally able to work)\b/i;

export type DealBreakerFlag = {
  characteristic: ProtectedCharacteristic;
  /** Shown at the point of entry. States what we will do, not what the law is. */
  message: string;
  /** Offered alternative, when there is an obvious one. */
  suggestion?: string;
};

/**
 * Flag one deal-breaker line, or null when it reads as work-related.
 */
export function screenDealBreaker(line: string | null | undefined): DealBreakerFlag | null {
  const text = (line ?? "").trim();
  if (text.length === 0) return null;
  if (WORK_AUTHORISATION.test(text)) return null;

  for (const rule of RULES) {
    if (!rule.pattern.test(text)) continue;
    const suggestion =
      rule.characteristic === "nationality or citizenship"
        ? "If you mean the candidate must already be able to work in your country, answer the visa sponsorship question instead — that is a work requirement and we do apply it."
        : undefined;
    return {
      characteristic: rule.characteristic,
      message: `This looks tied to ${rule.characteristic}, so we will not use it to filter candidates.`,
      suggestion,
    };
  }
  return null;
}

/** Flags by row index, for a whole list. Rows that read as work-related are absent. */
export function screenDealBreakers(lines: readonly (string | null | undefined)[]): Record<number, DealBreakerFlag> {
  const out: Record<number, DealBreakerFlag> = {};
  lines.forEach((line, i) => {
    const flag = screenDealBreaker(line);
    if (flag) out[i] = flag;
  });
  return out;
}

/** The lines that will actually be used as filters. */
export function usableDealBreakers(lines: readonly string[]): string[] {
  return lines.filter((l) => screenDealBreaker(l) === null);
}
