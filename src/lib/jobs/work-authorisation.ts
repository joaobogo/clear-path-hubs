/**
 * Work authorisation, asked once, plainly and lawfully.
 *
 * There is exactly one permitted pair of screening questions, and it is a
 * fixed template no model may rewrite. Nationality, birthplace, ethnicity,
 * visa type and immigration history are never asked, stored or scored.
 */

export type WorkAuthorisationInput = {
  /** Does the employer sponsor work authorisation? Must be answered. */
  sponsors?: boolean | null;
  /** Locations the employer can lawfully employ in. */
  countries?: string[] | null;
  /** A licence or professional registration the role legally requires. */
  licence_required?: string | null;
};

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The only two questions permitted on this subject, in this wording. */
export function lawfulAuthorisationQuestions(countries: string[] | null | undefined): string[] {
  const where = list(countries);
  const place = where.length > 0 ? where.join(" or ") : "the role's location";
  return [
    `Are you authorised to work in ${place}?`,
    `Will you now or in the future require sponsorship to work in ${place}?`,
  ];
}

/** The public sentence, or null when the sponsorship position is unanswered. */
export function authorisationStatement(input: WorkAuthorisationInput): string | null {
  if (typeof input.sponsors !== "boolean") return null;
  const where = list(input.countries);
  const place = where.length > 0 ? where.join(", ") : "";
  const licence = text(input.licence_required);

  const base = input.sponsors
    ? place
      ? `This employer sponsors work authorisation for ${place}.`
      : "This employer sponsors work authorisation."
    : place
      ? `No sponsorship — you need to be authorised to work in ${place} already.`
      : "No sponsorship — you need to be authorised to work in the role's location already.";

  return licence ? `${base} ${licence} is legally required for this role.` : base;
}

/**
 * Phrases that may never appear in a screening question. Matching blocks at
 * authoring time with the reason — it is not a post-publication warning.
 */
export const PROHIBITED_QUESTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bnationalit(y|ies)\b/i, reason: "Nationality cannot be asked or stored." },
  { pattern: /\bcitizenship\b|\bcitizen of\b/i, reason: "Citizenship is a nationality proxy. Ask about authorisation to work instead." },
  { pattern: /\bcountry of birth\b|\bbirthplace\b|\bborn in\b/i, reason: "Place of birth cannot be asked." },
  { pattern: /\bethnic(ity)?\b|\brace\b/i, reason: "Ethnicity and race cannot be asked or scored." },
  { pattern: /\bvisa (type|status|category)\b|\bwhat visa\b/i, reason: "Visa detail cannot be collected. Ask only whether sponsorship will be required." },
  { pattern: /\bimmigration (history|status)\b|\bresidence permit\b/i, reason: "Immigration history cannot be asked." },
  { pattern: /\bpassport\b/i, reason: "Passport or document detail is not collected at application time." },
  { pattern: /\bnative speaker\b|\bmother tongue\b/i, reason: "Native-speaker phrasing is a nationality proxy. State the language level required instead." },
  { pattern: /\b(age|how old|date of birth|dob)\b/i, reason: "Age and date of birth cannot be asked." },
  { pattern: /\b(marital status|married|children|pregnan\w+|family plans)\b/i, reason: "Family and marital status cannot be asked." },
  { pattern: /\b(religion|religious|church)\b/i, reason: "Religion cannot be asked." },
  { pattern: /\b(disabilit(y|ies)|health condition|medical history)\b/i, reason: "Health and disability cannot be asked as a screening question." },
];

export type ProhibitedFinding = { span: string; reason: string };

/** Returns every prohibited match in a question or a block of copy. */
export function findProhibitedContent(value: string): ProhibitedFinding[] {
  const t = text(value);
  if (!t) return [];
  const found: ProhibitedFinding[] = [];
  for (const { pattern, reason } of PROHIBITED_QUESTION_PATTERNS) {
    const m = t.match(pattern);
    if (m) found.push({ span: m[0], reason });
  }
  return found;
}

export function isProhibitedQuestion(value: string): boolean {
  return findProhibitedContent(value).length > 0;
}
