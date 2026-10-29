import { countryForDemonym, demonymWords } from "./geography";

/** National origin is never a hiring criterion; work authorisation is separate. */
export function isProtectedAttributeText(text: string): boolean {
  return /\bnationalit(?:y|ies)\b|\bethnic(?:ity|ities)?\b|\bcitizenship\b|\bheritage\b|\brace\b|\bracial\b|\bcountry of (?:birth|origin)\b|\b(?:passport|ancestry|descent|national origin|OCI)\b|\b(?:is|as|an?|be|born|native)\s+(?:Korean|Singaporean|Chinese|Indian|Egyptian|British|Irish|Pakistani|Sri Lankan|Vietnamese|Japanese|Emirati|Arab)\b|\b(?:Korean|Singaporean|Chinese|Indian|Egyptian|British|Irish|Pakistani|Sri Lankan|Vietnamese|Japanese|Emirati|Arab)\s+(?:candidate|national|citizen|origin|background|roots)\b/i.test(text);
}

/** Scrub every nested generated text field without touching raw source documents. */
export function sanitizeGeneratedText<T>(value: T): T {
  if (typeof value === "string") return removeProtectedSentences(value) as T;
  if (Array.isArray(value)) return value.map(sanitizeGeneratedText).filter((item) => item !== "") as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeGeneratedText(item)])) as T;
  }
  return value;
}

/**
 * Drop the sentences (and bar- or bullet-separated fields) that state a
 * protected attribute, keeping everything else exactly where it was.
 *
 * Line breaks are kept. The scorer reads a CV line by line (the header for
 * where someone lives, the line above a date for the job title, the education
 * section for degrees), so joining the CV into one line would cost every
 * candidate that structure. Only what states the attribute goes:
 * "Nationality: Indian | Dubai, UAE" keeps "Dubai, UAE".
 */
export function removeProtectedSentences(text: string): string {
  const kept: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    // Pieces alternate with the separators that joined them.
    const parts = line.split(/((?<=[.!?])\s+|\s*[|•·]\s*)/);
    let out = "";
    for (let i = 0; i < parts.length; i += 2) {
      const piece = parts[i] ?? "";
      if (isProtectedAttributeText(piece)) continue;
      out += (out && i > 0 ? (parts[i - 1] ?? " ") : "") + piece;
    }
    // A line that held only the attribute goes; a line that was already blank stays.
    if (out.trim() || !line.trim()) kept.push(out);
  }
  return kept.join("\n");
}

// ---------------------------------------------------------------------------
// Authoring guardrail: one detector for every place hiring criteria are
// written (client intake, the role editor, publishing, generated briefs) and
// for the data-health check.
//
// isProtectedAttributeText above is the scorer's filter and is deliberately
// left as it was: widening it would change which CV lines the scorer reads,
// and so change scores without an engine bump. The detector below looks for
// wording that sets a condition on the person, and explains each finding
// with a rewrite the author can accept. Nothing here rewrites text by itself:
// callers block the save and show the suggestion, and the author chooses.
// ---------------------------------------------------------------------------

export type ProtectedCategory =
  | "nationality"
  | "citizenship"
  | "age"
  | "gender"
  | "religion"
  | "marital_status"
  | "ethnicity"
  | "native_speaker";

export type ProtectedFinding = {
  category: ProtectedCategory;
  /** The words that state the attribute, exactly as written. */
  span: string;
  start: number;
  end: number;
  /** Why it cannot be a hiring criterion. Plain English, one or two sentences. */
  message: string;
  /** The wording offered in its place, or null when the right fix is to remove it. */
  suggestion: string | null;
  /** The whole text with this finding fixed ("" when nothing usable is left). */
  replacement: string;
};

export type ProtectedCriteriaOptions = {
  /** Used to word a market rewrite ("Marketing experience in ..."). */
  roleTitle?: string | null;
};

const MESSAGES: Record<ProtectedCategory, string> = {
  nationality:
    "Nationality can't be a hiring criterion. If the work needs knowledge of a market, ask for experience in that market instead.",
  citizenship:
    "Citizenship and passports can't be hiring criteria. Ask whether the person can work in the country instead.",
  age: "Age limits can't be used to screen candidates and are unlawful in most markets. Remove it, or describe the experience the work needs.",
  gender: "Gender can't be a hiring criterion. Remove it.",
  religion: "Religion can't be a hiring criterion. Remove it.",
  marital_status: "Marital or family status can't be a hiring criterion. Remove it.",
  ethnicity: "Ethnicity and race can't be hiring criteria. Remove it.",
  native_speaker:
    "'Native speaker' is a nationality proxy. Ask for the level of fluency the work needs instead.",
};

/** Plain-English names for the categories, for lists and counts. */
export const PROTECTED_CATEGORY_LABEL: Record<ProtectedCategory, string> = {
  nationality: "Nationality",
  citizenship: "Citizenship or passport",
  age: "Age",
  gender: "Gender",
  religion: "Religion",
  marital_status: "Marital or family status",
  ethnicity: "Ethnicity or race",
  native_speaker: "Native speaker",
};

/**
 * Sentences that say the opposite of a criterion: equal-opportunity
 * statements and open invitations ("We welcome applicants of any
 * nationality"). They name protected attributes precisely to rule them out.
 */
const INCLUSIVE =
  /\b(regardless\s+of|irrespective\s+of|without\s+regard\s+to|equal[\s-]+opportunit\w*|does\s+not\s+discriminate|do\s+not\s+discriminate|non[\s-]?discriminat\w*|all\s+nationalities|any\s+nationality|of\s+all\s+(?:ages|backgrounds|genders|faiths)|we\s+welcome|welcomes?\s+applica\w*|open\s+to\s+(?:all|everyone)|eeo|diversity)\b/i;

const LANGUAGES =
  "English|Arabic|French|German|Spanish|Portuguese|Italian|Dutch|Mandarin|Cantonese|Chinese|Japanese|Korean|Hindi|Urdu|Bengali|Tamil|Russian|Turkish|Persian|Farsi|Vietnamese|Thai|Malay|Bahasa|Indonesian|Tagalog|Filipino|Polish|Swedish|Norwegian|Danish|Finnish|Greek|Hebrew|Romanian|Czech|Hungarian|Ukrainian|Swahili";

/** Words that can stand for a nationality or ethnic group in a criterion. */
const DEMONYM =
  "(?:South\\s+Korean|North\\s+Korean|Sri\\s+Lankan|South\\s+African|New\\s+Zealand|Hong\\s+Kong|Saudi|Emirati|Arab|Arabic|Western|European|Asian|African|Latino|Latina|Hispanic|Caucasian|Local|UAE|UK|US|USA|EU|GCC|[A-Z][a-z]+(?:an|ian|ese|ish|ic|i|ch|ean))";

/**
 * Known nationality and group words only. "Must be Dynamic" or "Strategic
 * candidates preferred" end like a demonym and are not one, so these two
 * shapes never use the open pattern above.
 */
const KNOWN_DEMONYM = `(?:${[
  ...demonymWords().filter((w) => /^[A-Z][a-z]/.test(w)),
  "Arab",
  "Arabic",
  "Western",
  "European",
  "Asian",
  "African",
  "Latino",
  "Latina",
  "Hispanic",
  "Caucasian",
]
  .sort((a, b) => b.length - a.length)
  .map((w) => w.replace(/\s+/g, "\\s+"))
  .join("|")})`;

type Rule = {
  category: ProtectedCategory;
  pattern: RegExp;
  /** The wording to put in place of the match, or null to remove it. */
  rewrite?: (m: RegExpExecArray, opts: ProtectedCriteriaOptions) => string | null;
  /** Skip a match that is not about the person. */
  skip?: (m: RegExpExecArray, text: string) => boolean;
};

const ROLE_FUNCTIONS =
  /\b(marketing|sales|brand|finance|accounting|engineering|operations|product|design|legal|procurement|supply\s+chain|hr|human\s+resources|retail|business\s+development|customer\s+success|consulting)\b/i;

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function experiencePrefix(opts: ProtectedCriteriaOptions): string {
  const fn = (opts.roleTitle ?? "").match(ROLE_FUNCTIONS)?.[1];
  if (!fn) return "Experience";
  const word = fn.length <= 2 ? fn.toUpperCase() : fn.toLowerCase();
  return `${capitalise(word)} experience`;
}

const isArab = (w: string) => /^arab(?:ic)?$/i.test(w.trim());

/** "Korean nationality" -> "Marketing experience in the South Korean market". */
function marketRewrite(demonym: string, opts: ProtectedCriteriaOptions): string | null {
  if (isArab(demonym)) return "Arabic language skills";
  const c = countryForDemonym(demonym.replace(/\s+/g, " "));
  if (!c) return null;
  return `${experiencePrefix(opts)} in the ${c.marketAdjective} market`;
}

/** "Must be a UK citizen" -> "Eligible to work in the UK". */
function workRewrite(demonym: string | undefined): string {
  if (demonym && /^(EU|European)$/i.test(demonym.trim())) return "Eligible to work in the EU";
  const c = demonym ? countryForDemonym(demonym.replace(/\s+/g, " ")) : null;
  return c ? `Eligible to work in ${c.workIn}` : "Eligible to work in the country of employment";
}

/** "Must be (a|of)" / "preferably" / "only" before an attribute belongs to the finding. */
const BE =
  "(?:(?:[Mm]ust|[Ss]hould|[Ww]ill|[Tt]o)\\s+(?:be|hold|have)\\s+(?:an?\\s+|of\\s+)?|[Pp]referably\\s+(?:an?\\s+)?|[Oo]nly\\s+)?";
/** "... only" / "... preferred" after it does too. */
const AFTER = "(?:\\s+(?:only|preferred|required|is\\s+(?:a\\s+)?must))?";

/** "over 18", "18+", "minimum age 21": a statutory minimum, with no upper bound. */
function isLegalMinimumAge(span: string): boolean {
  const nums = [...span.matchAll(/\d{2}/g)].map((x) => Number(x[0]));
  if (nums.length !== 1 || nums[0]! > 21) return false;
  if (/\b(under|below|younger|max(?:imum)?|between|to|and)\b|[-–]\s*\d/i.test(span)) return false;
  return /\b(over|above|min(?:imum)?|at\s+least|or\s+(?:older|over|above))\b|\+/i.test(span);
}

const RULES: Rule[] = [
  // Native speaker: "Native English speaker" -> "Fluent English speaker".
  {
    category: "native_speaker",
    pattern: new RegExp(
      `\\bnative(?=\\s+(?:${LANGUAGES})\\b|\\s+speakers?\\b)|\\bnative[\\s-]+level\\b|\\bmother[\\s-]+tongue\\b`,
      "gi",
    ),
    rewrite: (m) => (/^[A-Z]/.test(m[0]) ? "Fluent" : "fluent"),
  },
  // Citizenship or a passport as a condition: "Must be a UK citizen".
  {
    category: "citizenship",
    pattern: new RegExp(
      `\\b${BE}(${DEMONYM})\\s+(?:citizen(?:s|ship)?|passport(?:\\s+holders?)?)${AFTER}\\b|\\b(?:[Cc]itizen(?:s|ship)?|[Pp]assport)\\s+(?:of|from)\\s+(?:the\\s+)?(${DEMONYM}|[A-Z][\\w.]+(?:\\s+[A-Z][\\w.]+)?)|\\b(?:[Mm]ust|[Ss]hould)\\s+be\\s+an?\\s+citizen\\b|\\b[Cc]itizenship\\b|\\b[Pp]assport\\s+holders?\\s+(?:only|preferred|required)\\b`,
      "g",
    ),
    rewrite: (m) => workRewrite(m[1] ?? m[2]),
  },
  // Nationality: "Korean nationality", "Arab nationals only", "must be Singaporean".
  {
    category: "nationality",
    pattern: new RegExp(
      `\\b${BE}(${DEMONYM})\\s+(?:[Nn]ationality|[Nn]ationals?|[Oo]rigin|[Dd]escent|[Aa]ncestry|[Hh]eritage|[Rr]oots)${AFTER}\\b|\\b(?:[Nn]ationality|[Nn]ational\\s+origin)\\s*[:\\-–]?\\s*(?:of\\s+)?(${DEMONYM})\\b|\\b(?:of|with)\\s+(${DEMONYM})\\s+(?:nationality|origin|descent)\\b|\\b(?:[Mm]ust|[Ss]hould)\\s+be\\s+(?:an?\\s+)?(${KNOWN_DEMONYM})\\b(?!\\s+(?:market|speak|language|fluen|-?speaking))|\\b(${KNOWN_DEMONYM})\\s+(?:candidates?|applicants?|people|persons?|staff)\\s+(?:only|preferred)\\b|\\b(?:[Nn]ative\\s+of|[Bb]orn\\s+in(?!\\s+[12]\\d{3}))(?:\\s+(?:the\\s+)?[A-Z][\\w.'’-]*(?:\\s+[A-Z][\\w.'’-]*)*)?|\\b[Cc]ountry\\s+of\\s+(?:birth|origin)\\b(?:\\s*[:\\-–]?\\s*[A-Z][\\w.'’-]*(?:\\s+[A-Z][\\w.'’-]*)*)?|\\b[Nn]ationalit(?:y|ies)\\b`,
      "g",
    ),
    rewrite: (m, opts) => {
      const d = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
      return d ? marketRewrite(d, opts) : null;
    },
  },
  // Age limits.
  {
    category: "age",
    pattern:
      /\b(?:age[ds]?|aged)\s*(?:limit|range|bracket|requirement)?\s*(?:[:\-–]|of|is|between|from|under|below|over|above|up\s+to|max(?:imum)?|min(?:imum)?|not\s+(?:more|less)\s+than)?\s*(?:of\s+)?\d{2}(?:\s*\+)?(?:\s*(?:-|–|to|and)\s*\d{2})?(?:\s*(?:years?|yrs?)(?:\s+old)?)?(?:\s+(?:or\s+(?:younger|older|less|below|under|above|over)|max(?:imum)?|only|preferred))?|\b(?:max(?:imum)?|min(?:imum)?)\.?\s+age\b(?:\s*(?:of|:)?\s*\d{2})?|\bage\s+limit\b|\b\d{2}\s*(?:(?:-|–|to)\s*\d{2}\s*)?(?:years?|yrs?)[\s-]*old\b(?:\s+or\s+(?:younger|older|less|under|below|above|over))?|\b(?:under|below|younger\s+than|older\s+than|not\s+older\s+than|no\s+older\s+than|not\s+over|over|above)\s+(?:the\s+age\s+of\s+)?\d{2}\b(?=\s*(?:$|[.,;:)!]|only\b|preferred\b|please\b|years?\s+(?:old|of\s+age)\b|y\/?o\b))(?:\s+(?:years?\s+(?:old|of\s+age)|only|preferred))?|\bborn\s+(?:after|before|between|in\s+(?:19|20)\d{2})\b(?:\s+(?:19|20)\d{2})?|\b(?:young|youthful)\s+(?:candidates?|applicants?|persons?|people|professionals?|graduates?|talent|team\s+members?|blood)\b|\bdigital\s+natives?\b/gi,
    skip: (m, text) =>
      // "over 10 years of experience" is about experience, not age.
      (/^(?:over|above|under|below)\s/i.test(m[0]) &&
        /^\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp\b|in\b|working|managing)/i.test(
          text.slice(m.index + m[0].length),
        )) ||
      // A legal minimum age ("Must be over 18", "Age 21+") is a licensing
      // condition for some work (alcohol, driving), not an age preference.
      isLegalMinimumAge(m[0]),
  },
  // Gender.
  {
    category: "gender",
    pattern:
      /\b(?:(?:must|should)\s+be\s+(?:an?\s+)?)?(?:male|female|men|women|man|woman|ladies|lady|gentlem[ae]n|boys?|girls?)\s+(?:only|preferred|candidates?\s+(?:only|preferred)|applicants?\s+(?:only|preferred))\b|\b(?:must|should)\s+be\s+(?:an?\s+)?(?:male|female|man|woman)\b|\b(?:only\s+)?(?:male|female)\s+(?:candidates?|applicants?)\b|\bgender\s*(?::|–|\s-\s|\s+preference|\s+requirement)\s*(?:male|female|men|women|m|f)?\b|\bgender\s+(?:male|female)\b/gi,
  },
  // Religion.
  {
    category: "religion",
    pattern:
      /\b(?:must|should)\s+be\s+(?:an?\s+)?(?:practi[sc]ing\s+)?(?:muslim|christian|jewish|hindu|buddhist|sikh|catholic|protestant)\b|\b(?:practi[sc]ing\s+)?(?:muslims?|christians?|jews|jewish|hindus?|buddhists?|sikhs?|catholics?|protestants?)\s+(?:only|preferred|candidates?|applicants?)\b|\breligio(?:n|us)\s*(?:[:\-–]|affiliation|background|preference|requirement)/gi,
  },
  // Marital or family status.
  {
    category: "marital_status",
    pattern:
      /\b(?:single|married|unmarried|divorced|widowed)\s+(?:candidates?|applicants?|persons?|people|only|preferred|required|status)\b|\b(?:must|should)\s+be\s+(?:single|married|unmarried)\b|\bmarital\s+status\b|\bno\s+(?:children|kids|family\s+commitments|dependants|dependents)\b|\bwithout\s+(?:children|kids)\b|\bnot\s+pregnant\b|\bno\s+plans?\s+(?:for|to\s+have)\s+(?:children|a\s+family|kids)\b/gi,
  },
  // Ethnicity or race.
  {
    category: "ethnicity",
    pattern:
      /\b(?:ethnicity|ethnic\s+(?:background|origin|group|minority|majority)|racial(?:\s+background)?)\b|\brace\s*(?:[:\-–]|preference|requirement)|\b(?:caucasian|white|black|asian|hispanic|latino|latina|arab)\s+(?:only|preferred|candidates?|applicants?|appearance|looks?|people|persons?)\b|\bfair[\s-]+(?:skin(?:ned)?|complexion)\b/gi,
    rewrite: (m) => (/\barab\b/i.test(m[0]) ? "Arabic language skills" : null),
  },
];

/** What is left when only connectors remain: nothing worth keeping. */
const FILLER =
  /^(?:\s|[,;:/&().-]|\b(?:and|or|must|should|be|is|are|a|an|the|of|with|candidates?|applicants?|only|preferred|required|please|ideally|aged?|years?|old|between|from|to)\b)*$/i;

/** Remove [start, end) along with the separator that tied it to the rest. */
function removeSpan(text: string, start: number, end: number): string {
  let a = start;
  let b = end;
  const sep = text.slice(0, a).match(/(?:\s*[,;/]\s*|\s+(?:and|or|&)\s+|\s*[-–—]\s+)$/);
  if (sep) a -= sep[0].length;
  else {
    const after = text.slice(b).match(/^(?:\s*[,;/]\s*|\s+(?:and|or|&)\s+|[.!]\s*)/);
    if (after) b += after[0].length;
  }
  const out = (text.slice(0, a) + text.slice(b))
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
    // A sentence left holding only "Must be" goes with what it introduced.
    .split(/(?<=[.!?])\s+/)
    .filter((piece) => !FILLER.test(piece.replace(/[.!?]+$/, "")))
    .join(" ");
  if (FILLER.test(out)) return "";
  return out.replace(/^[,;:\s-]+/, "").replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

function replaceSpan(text: string, start: number, end: number, by: string): string {
  const head = text.slice(0, start);
  const tail = text.slice(end);
  // A rewrite that says the whole thing ("Marketing experience in the South
  // Korean market") stands alone when the rest of the line is only filler.
  if (FILLER.test(head + tail)) return by;
  const piece =
    head.trim() === "" || /[.!?]\s*$/.test(head) ? by : by.charAt(0).toLowerCase() + by.slice(1);
  return (head + piece + tail).replace(/\s{2,}/g, " ").trim();
}

/** Sentences with their offsets, so an inclusive statement is skipped as a whole. */
function sentences(text: string): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  const re = /[^.!?\n]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  return out;
}

/**
 * Every place a piece of hiring criteria sets a condition on a protected
 * attribute, in reading order, each with a plain-English reason and a
 * suggested rewrite. Market, location and work-authorisation wording
 * ("Experience in the Korean market", "Based in Dubai", "Eligible to work in
 * the UAE", "Arabic language skills") is not a finding.
 */
export function findProtectedCriteria(
  text: string | null | undefined,
  opts: ProtectedCriteriaOptions = {},
): ProtectedFinding[] {
  const t = typeof text === "string" ? text : "";
  if (!t.trim()) return [];
  const inclusive = sentences(t).filter((s) => INCLUSIVE.test(s.text));
  const insideInclusive = (i: number) => inclusive.some((s) => i >= s.start && i < s.end);

  const raw: Array<Omit<ProtectedFinding, "replacement">> = [];
  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      if (m[0].trim().length === 0) {
        re.lastIndex += 1;
        continue;
      }
      const span = m[0].replace(/\s+$/, "");
      const start = m.index;
      const end = start + span.length;
      if (insideInclusive(start)) continue;
      if (rule.skip?.(m, t)) continue;
      if (raw.some((f) => start < f.end && end > f.start)) continue;
      raw.push({
        category: rule.category,
        span,
        start,
        end,
        message: MESSAGES[rule.category],
        suggestion: rule.rewrite ? rule.rewrite(m, opts) : null,
      });
    }
  }
  raw.sort((a, b) => a.start - b.start);
  return raw.map((f) => ({
    ...f,
    replacement:
      f.suggestion === null ? removeSpan(t, f.start, f.end) : replaceSpan(t, f.start, f.end, f.suggestion),
  }));
}

/** The text with every finding fixed, one at a time so offsets stay valid. "" means remove it. */
export function suggestedRewrite(text: string, opts: ProtectedCriteriaOptions = {}): string {
  let out = text;
  for (let i = 0; i < 12; i++) {
    const f = findProtectedCriteria(out, opts)[0];
    if (!f) return out;
    out = f.replacement;
    if (!out) return "";
  }
  return out;
}

export function hasProtectedCriteria(text: string | null | undefined): boolean {
  return findProtectedCriteria(text).length > 0;
}

/** One criterion as a form shows it: which list, which row, what it says. */
export type CriteriaField = {
  /** Form field key, e.g. "must_have_skills" or "requirements". */
  field: string;
  /** Row within the list, when the field is a list. */
  index?: number;
  /** How the field is named on screen, e.g. "Must-have 2". */
  label: string;
  text: string;
};

export type CriteriaFieldFinding = CriteriaField & {
  findings: ProtectedFinding[];
  /** The row with every finding fixed: "" means remove the row. */
  replacement: string;
};

export function findProtectedCriteriaInFields(
  fields: CriteriaField[],
  opts: ProtectedCriteriaOptions = {},
): CriteriaFieldFinding[] {
  const out: CriteriaFieldFinding[] = [];
  for (const f of fields) {
    const findings = findProtectedCriteria(f.text, opts);
    if (findings.length === 0) continue;
    out.push({ ...f, findings, replacement: suggestedRewrite(f.text, opts) });
  }
  return out;
}

export const PROTECTED_CRITERIA_ERROR_PREFIX = "protected_criteria: ";

/**
 * The error a save or publish refuses with: every finding, the reason, and
 * the suggested wording, so the message is useful wherever it is shown.
 */
export function protectedCriteriaErrorMessage(found: CriteriaFieldFinding[]): string {
  const lines = found.map((f) => {
    const why = [...new Set(f.findings.map((x) => x.message))].join(" ");
    const fix = f.replacement ? `Suggested: "${f.replacement}".` : "Suggested: remove it.";
    return `${f.label} ("${f.text}"): ${why} ${fix}`;
  });
  return (
    PROTECTED_CRITERIA_ERROR_PREFIX +
    `${found.length === 1 ? "One criterion uses" : `${found.length} criteria use`} protected-attribute wording and can't be saved. ` +
    lines.join(" | ")
  );
}

/** Throws the message above when any field has a finding. */
export function assertNoProtectedCriteria(
  fields: CriteriaField[],
  opts: ProtectedCriteriaOptions = {},
): void {
  const found = findProtectedCriteriaInFields(fields, opts);
  if (found.length > 0) throw new Error(protectedCriteriaErrorMessage(found));
}

/** Strings from a stored requirement list ({label} objects or plain strings). */
export function criteriaLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) =>
      typeof v === "string"
        ? v
        : v && typeof v === "object"
          ? String((v as Record<string, unknown>).label ?? (v as Record<string, unknown>).text ?? "")
          : "",
    )
    .filter((s) => s.trim().length > 0);
}

/** A list as fields, labelled "Must-have 1", "Must-have 2", ... */
export function listFields(field: string, noun: string, values: readonly unknown[] | null | undefined): CriteriaField[] {
  return (values ?? [])
    .map((v, i) => ({ field, index: i, label: `${noun} ${i + 1}`, text: typeof v === "string" ? v : "" }))
    .filter((f) => f.text.trim().length > 0);
}
