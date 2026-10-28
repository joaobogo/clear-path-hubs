/**
 * Recruiter-style rules for three requirement shapes the keyword matcher
 * cannot judge (owner request, 29 Oct 2026, Stratium Partners).
 *
 * The engine decides most requirements by counting how many of the
 * requirement's words appear in the CV. That is right for "Experience with
 * Salesforce" and wrong for three common shapes:
 *
 *   1. "Bachelor's degree in Marketing, Business Administration or a related
 *      field". No CV contains the words "related field"; a BBA in Marketing
 *      matched only "bachelor" and "marketing" and came out Partial, and a
 *      degree in Mass Communication came out Partial or Missing. A recruiter
 *      reads the subject and asks whether it is related.
 *   2. "If outside the UAE, must be willing to relocate to Dubai". A candidate
 *      who already lives in Dubai never writes "relocate", so the row came out
 *      Missing and cost her points for a condition that does not apply to her.
 *   3. "10 or more years of progressive marketing experience". "years" is a
 *      framing word the matcher ignores, so the number was never compared with
 *      anything: the row turned on whether "progressive" appeared.
 *
 * Each rule returns a status with the CV line it relied on, or null when the
 * requirement is not one of these shapes (the keyword matcher then decides as
 * before). The rules never invent evidence: every Met carries a quote, and
 * where the CV cannot settle the question the answer is Unknown with
 * needs_validation, never a zero.
 *
 * Nothing here reads names, nationality, phone numbers or where someone
 * studied as a proxy for anything; location is read only from an explicit
 * location line or the CV's own header.
 */

export type StructuredStatus = "met" | "partial" | "missing" | "unknown";

export type StructuredEvidence = { snippet: string; start: number; end: number };

export type StructuredVerdict = {
  rule: "degree_field" | "conditional_relocation" | "minimum_years";
  status: StructuredStatus;
  needs_validation: boolean;
  /** One sentence a reviewer can read: what was found and why it decided this. */
  note: string;
  evidence: StructuredEvidence[];
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type Line = { text: string; start: number; end: number };

function lines(cv: string): Line[] {
  const out: Line[] = [];
  let pos = 0;
  for (const raw of cv.split("\n")) {
    const start = pos;
    const end = pos + raw.length;
    pos = end + 1;
    const text = raw.trim();
    if (text) out.push({ text, start, end });
  }
  return out;
}

function quote(l: Line, max = 220): StructuredEvidence {
  const snippet = l.text.length > max ? `${l.text.slice(0, max - 1)}…` : l.text;
  return { snippet, start: l.start, end: l.end };
}

// ---------------------------------------------------------------------------
// 1. Degree and field of study
// ---------------------------------------------------------------------------

type FieldFamily = "marketing" | "business";

/**
 * Subjects a recruiter would read as the same family. Marketing and business
 * are adjacent: a requirement that names both "or a related field" accepts
 * either family. Kept deliberately short; anything not listed is "not related"
 * only when the subject is clearly named (see UNRELATED_SUBJECTS), otherwise
 * Unknown.
 */
const FAMILY_TERMS: Record<FieldFamily, RegExp> = {
  marketing:
    /\b(marketing|advertising|mass\s+communications?|communications?|media\s+studies|media|public\s+relations|journalism|brand(?:ing)?\s+management|consumer\s+behaviou?r)\b/i,
  business:
    /\b(business(?:\s+administration|\s+management|\s+studies)?|commerce|management|economics|finance|accounting|accountancy|international\s+business|entrepreneurship|hospitality\s+management|retail\s+management|e-?commerce)\b|\b(bba|b\.?\s?com|mba)\b/i,
};

/** Clearly named subjects outside both families. */
const UNRELATED_SUBJECTS =
  /\b(history|ancient\s+history|mathematics|applied\s+mathematics|maths?|physics|chemistry|biology|microbiology|biochemistry|biotechnology|medicine|pharmacy|nursing|dentistry|zoology|botany|geology|engineering|civil\s+engineering|mechanical\s+engineering|electrical\s+engineering|computer\s+science|information\s+technology|architecture|law|llb|philosophy|theology|music|fine\s+arts|agriculture|veterinary)\b/i;

const BACHELOR_RE =
  /\b(bachelor(?:'s|s)?(?:\s+of|\s+degree)?|b\.\s?a\.|b\.\s?sc\.?|bsc|b\.\s?com\.?|bcom|bba|b\.\s?eng\.?|beng|b\.\s?tech|btech|undergraduate\s+degree)\b|\bBA\b(?=\s*(\(hons\)|in\b|of\b|,|-|–|—|[A-Z]))/i;
/**
 * Postgraduate qualifications: a master's, an MBA, a postgraduate diploma or
 * certificate. Holding one means holding a first degree — nobody is admitted
 * to postgraduate study without one, and CVs often list only the higher
 * qualification because the first is taken as read (owner, 29 Oct 2026, on a
 * candidate whose CV lists only a CIM Postgraduate Diploma in Marketing).
 */
const MASTER_RE =
  /\b(mba|emba|master(?:'s|s)?(?:\s+of|\s+degree)?|m\.\s?sc\.?|msc|m\.\s?a\.|mphil|post-?graduate\s+(?:degree|diploma|certificate)|pg\s*dip(?:loma)?|pgd(?:m|ba)?)\b|\bMA\b(?=\s*(\(hons\)|in\b|of\b|,|-|–|—))/i;
/** Professional diplomas below postgraduate level ("Diploma in Digital Marketing"). */
const PRO_DIPLOMA_RE = /\b(diploma\s+in|professional\s+diploma|certificate\s+in)\b/i;

type DegreeFound = {
  level: "bachelor" | "master" | "pro_diploma";
  families: FieldFamily[];
  unrelated: boolean;
  /** True when the subject is not stated at all ("Bachelor of Arts"). */
  subjectless: boolean;
  line: Line;
};

function familiesIn(text: string): FieldFamily[] {
  return (Object.keys(FAMILY_TERMS) as FieldFamily[]).filter((f) => FAMILY_TERMS[f].test(text));
}

/** "Bachelor of Arts" / "BA" with nothing after it names no subject. */
function isSubjectless(text: string): boolean {
  const stripped = text
    .replace(/\(hons\)|\bhons\b|honou?rs/gi, "")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(
      /[,|·•–—-]\s*[^,|·•–—-]*(university|college|institute|school|academy)[^,|·•–—-]*/gi,
      "",
    );
  return /^\s*(bachelor(?:'s|s)?\s+(of\s+)?(arts|science)|b\.?\s?a\.?|ba|b\.?\s?sc\.?|bsc)\s*[,.:;|–—-]?\s*$/i.test(
    stripped.trim(),
  );
}

export function findDegrees(cv: string): DegreeFound[] {
  const ls = lines(cv);
  const out: DegreeFound[] = [];
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i]!;
    const level: DegreeFound["level"] | null = BACHELOR_RE.test(l.text)
      ? "bachelor"
      : MASTER_RE.test(l.text)
        ? "master"
        : PRO_DIPLOMA_RE.test(l.text)
          ? "pro_diploma"
          : null;
    if (!level) continue;
    // A subject sometimes sits on the next line ("Major: Marketing"), unless
    // that line starts another qualification.
    const next = ls[i + 1];
    const nextIsDegree =
      next &&
      (BACHELOR_RE.test(next.text) || MASTER_RE.test(next.text) || PRO_DIPLOMA_RE.test(next.text));
    const subjectLine =
      next &&
      !nextIsDegree &&
      /^(major|minor|specialisation|specialization|concentration|field|subject)\b/i.test(next.text)
        ? `${l.text} ${next.text}`
        : l.text;
    // The degree abbreviations themselves (BBA, B.Com, MBA) name a business
    // subject; "B.Sc" and "BA" do not.
    const families = familiesIn(subjectLine);
    const unrelated = families.length === 0 && UNRELATED_SUBJECTS.test(subjectLine);
    out.push({
      level,
      families,
      unrelated,
      subjectless: families.length === 0 && !unrelated && isSubjectless(l.text),
      line: l,
    });
  }
  return out;
}

/** "Bachelor's degree in Marketing, Business Administration or a related field". */
export function parseDegreeRequirement(
  text: string,
): { families: FieldFamily[]; related: boolean } | null {
  if (!/\b(bachelor|degree|graduate|university)\b/i.test(text)) return null;
  // Experience requirements mention degrees in passing; this rule is only for
  // the qualification itself.
  if (/\byears?\b/i.test(text)) return null;
  const families = familiesIn(text);
  if (families.length === 0) return null;
  const related =
    /\b(related|relevant|equivalent|similar|allied)\s+(field|discipline|subject|area|degree)s?\b/i.test(
      text,
    );
  return { families, related };
}

export function evaluateDegreeRequirement(text: string, cv: string): StructuredVerdict | null {
  const req = parseDegreeRequirement(text);
  if (!req) return null;
  // With "or a related field", marketing and business accept each other.
  const accepted = new Set<FieldFamily>(req.related ? ["marketing", "business"] : req.families);
  const degrees = findDegrees(cv);
  const fits = (d: DegreeFound) => d.families.some((f) => accepted.has(f));

  const bachelorFit = degrees.find((d) => d.level === "bachelor" && fits(d));
  if (bachelorFit) {
    return {
      rule: "degree_field",
      status: "met",
      needs_validation: false,
      note: req.related
        ? "Bachelor's degree in the named or a related field."
        : "Bachelor's degree in the named field.",
      evidence: [quote(bachelorFit.line)],
    };
  }

  // A postgraduate qualification in the field (master's, MBA, postgraduate
  // diploma). It implies a first degree, and the qualification that matters
  // most to the role is in the field: a recruiter counts this as met.
  const masterFit = degrees.find((d) => d.level === "master" && fits(d));
  if (masterFit) {
    const first = degrees.find((d) => d.level === "bachelor");
    return {
      rule: "degree_field",
      status: "met",
      needs_validation: false,
      note: first
        ? "Postgraduate qualification in the field, on top of a first degree in another subject."
        : "Postgraduate qualification in the field, which presupposes a first degree.",
      evidence: [quote(masterFit.line), ...(first ? [quote(first.line)] : [])],
    };
  }

  const bachelors = degrees.filter((d) => d.level === "bachelor");
  const postgrads = degrees.filter((d) => d.level === "master");
  const diplomaFit = degrees.find((d) => d.level === "pro_diploma" && fits(d));

  // Subject not stated, or no degree on the CV at all: a question, not a zero.
  // A postgraduate qualification outside the field still proves a degree is
  // held, so the only open question is the first degree's subject.
  if (
    bachelors.length === 0 ||
    bachelors.every((d) => d.subjectless || (!d.unrelated && d.families.length === 0))
  ) {
    const shown = bachelors[0] ?? postgrads[0] ?? diplomaFit;
    return {
      rule: "degree_field",
      status: "unknown",
      needs_validation: true,
      note:
        bachelors.length === 0
          ? postgrads.length > 0
            ? "Holds a postgraduate qualification, so a first degree is held; its subject is not listed. Confirm at screening."
            : diplomaFit
              ? "Holds a professional qualification in the field; no degree is listed. Confirm at screening."
              : "No degree is listed on the CV. Confirm at screening."
          : "A bachelor's degree is listed without its subject. Confirm the subject at screening.",
      evidence: shown ? [quote(shown.line)] : [],
    };
  }

  // A clearly named subject outside the field, with nothing in the field above it.
  const named = bachelors.find((d) => d.unrelated) ?? bachelors[0]!;
  return {
    rule: "degree_field",
    status: diplomaFit ? "partial" : "missing",
    needs_validation: Boolean(diplomaFit),
    note: diplomaFit
      ? "Bachelor's degree in an unrelated subject, with a professional qualification in the field."
      : "Bachelor's degree in a subject outside the named and related fields.",
    evidence: [quote(named.line), ...(diplomaFit ? [quote(diplomaFit.line)] : [])],
  };
}

// ---------------------------------------------------------------------------
// 2. Conditional relocation: "If outside the UAE, must be willing to relocate"
// ---------------------------------------------------------------------------

const UAE_PLACES =
  /\b(united\s+arab\s+emirates|u\.?a\.?e\.?|dubai|abu\s+dhabi|sharjah|ajman|ras\s+al[\s-]khaimah|fujairah|umm\s+al[\s-]quwain|al\s+ain)\b/i;

function placePattern(requirement: string): RegExp | null {
  if (UAE_PLACES.test(requirement)) return UAE_PLACES;
  const m = requirement.match(
    /\boutside\s+(?:of\s+)?(?:the\s+)?([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,3})/,
  );
  if (!m) return null;
  const name = m[1]!.trim().replace(/\.$/, "");
  return new RegExp(
    `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`,
    "i",
  );
}

export function parseRelocationRequirement(text: string): { place: RegExp } | null {
  if (!/\breloca\w*/i.test(text)) return null;
  if (
    !/\b(if|unless|when)\b[^.]*\b(outside|not\s+(?:based|located|living|resident)|abroad|overseas)\b/i.test(
      text,
    )
  )
    return null;
  const place = placePattern(text);
  return place ? { place } : null;
}

const LOCATION_LABEL =
  /^(location|address|based\s+in|current\s+location|residence|city|lives?\s+in)\b/i;

/** Where the candidate says they are now: an explicit location line, or a short header line. */
function candidateLocationLine(cv: string, place: RegExp): Line | null {
  const ls = lines(cv);
  const labelled = ls.find(
    (l) => (LOCATION_LABEL.test(l.text) || /\bbased\s+in\b/i.test(l.text)) && place.test(l.text),
  );
  if (labelled) return labelled;
  // The CV header: the first lines, short ones only, so a summary sentence
  // about past work in Dubai is not read as where someone lives.
  return ls.slice(0, 8).find((l) => l.text.length <= 120 && place.test(l.text)) ?? null;
}

export function evaluateRelocationRequirement(text: string, cv: string): StructuredVerdict | null {
  const req = parseRelocationRequirement(text);
  if (!req) return null;
  const here = candidateLocationLine(cv, req.place);
  if (here) {
    return {
      rule: "conditional_relocation",
      status: "met",
      needs_validation: false,
      note: "Already based in the location, so the relocation condition does not apply.",
      evidence: [quote(here)],
    };
  }
  const willing = lines(cv).find((l) =>
    /\b(willing|open|happy|ready|able|available)\s+to\s+relocate\b|\bopen\s+to\s+relocation\b|\brelocation\s*[:\-–]\s*(yes|open)\b/i.test(
      l.text,
    ),
  );
  if (willing) {
    return {
      rule: "conditional_relocation",
      status: "met",
      needs_validation: false,
      note: "States willingness to relocate.",
      evidence: [quote(willing)],
    };
  }
  return {
    rule: "conditional_relocation",
    status: "unknown",
    needs_validation: true,
    note: "Current location or willingness to relocate is not stated. Ask at screening.",
    evidence: [],
  };
}

// ---------------------------------------------------------------------------
// 3. Minimum years: "10 or more years of progressive marketing experience"
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const MONTH_NAME =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const POINT = `(?:${MONTH_NAME}\\.?\\s+)?((?:19|20)\\d{2})|(\\d{1,2})\\/((?:19|20)\\d{2})`;
const END = `(present|current|now|today|ongoing|to\\s+date|date)|${POINT}`;
const RANGE_RE = new RegExp(`(?:${POINT})\\s*(?:-|–|—|to|until|till)\\s*(?:${END})`, "gi");

type Span = { from: number; to: number; line: Line };

/** Month index since year 0, for arithmetic. */
function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

export function findDatedRanges(cv: string, today: Date = new Date()): Span[] {
  const now = monthIndex(today.getUTCFullYear(), today.getUTCMonth());
  const out: Span[] = [];
  for (const l of lines(cv)) {
    RANGE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RANGE_RE.exec(l.text)) !== null) {
      // Groups: 1 month name, 2 year, 3 numeric month, 4 numeric year (start);
      // 5 open end word; 6 month name, 7 year, 8 numeric month, 9 year (end).
      const startYear = Number(m[2] ?? m[4]);
      const startMonth = m[1]
        ? (MONTHS[m[1].slice(0, 3).toLowerCase()] ?? 0)
        : m[3]
          ? Number(m[3]) - 1
          : 0;
      let to: number;
      if (m[5]) to = now;
      else {
        const endYear = Number(m[7] ?? m[9]);
        // A year-only end means "some time that year"; count to December, but
        // never past today.
        const endMonth = m[6]
          ? (MONTHS[m[6].slice(0, 3).toLowerCase()] ?? 11)
          : m[8]
            ? Number(m[8]) - 1
            : 11;
        to = Math.min(monthIndex(endYear, endMonth), now);
      }
      const from = monthIndex(startYear, Math.min(Math.max(startMonth, 0), 11));
      if (to >= from && startYear >= 1960) out.push({ from, to, line: l });
    }
  }
  return out;
}

/** Total months covered by the spans, overlaps counted once. */
function unionMonths(spans: Span[]): number {
  const sorted = [...spans].sort((a, b) => a.from - b.from);
  let total = 0;
  let curFrom = -1;
  let curTo = -1;
  for (const s of sorted) {
    if (s.from > curTo + 1) {
      if (curTo >= curFrom && curFrom >= 0) total += curTo - curFrom + 1;
      curFrom = s.from;
      curTo = s.to;
    } else curTo = Math.max(curTo, s.to);
  }
  if (curFrom >= 0) total += curTo - curFrom + 1;
  return total;
}

const EDUCATION_LINE =
  /\b(university|college|school|academy|institute|bachelor|master|mba|degree|diploma|b\.?\s?sc|bsc|bba)\b/i;
const SENIOR_TITLE =
  /\b(head|director|vice\s+president|vp|svp|evp|avp|chief|cmo|cco|general\s+manager|gm|managing\s+director|partner|founder|co-?founder)\b/i;
const LEAD_TITLE = new RegExp(`${SENIOR_TITLE.source}|\\b(manager|lead|leader)\\b`, "i");
const MARKETING_TITLE =
  /\b(marketing|brand|communications?|digital|growth|crm|loyalty|advertising|media|pr|public\s+relations|content|campaigns?|trade\s+marketing|category)\b/i;

/** The role title for a dated line: the line itself, or one of the two lines above it. */
function titleContext(cv: string, span: Span): string {
  const ls = lines(cv);
  const i = ls.findIndex((l) => l.start === span.line.start);
  return [ls[i - 2], ls[i - 1], ls[i]]
    .filter(Boolean)
    .map((l) => l!.text)
    .join(" | ");
}

export function parseYearsRequirement(
  text: string,
): { min: number; kind: "any" | "leadership" | "senior" } | null {
  const m =
    text.match(
      /\b(?:at\s+least|minimum(?:\s+of)?|min\.?)\s+(\d{1,2})(?:\s*(?:-|–|to)\s*\d{1,2})?\s*\+?\s*years?\b/i,
    ) ??
    text.match(/\b(\d{1,2})\s*(?:\+|or\s+more|plus)\s*years?\b/i) ??
    text.match(/\b(\d{1,2})\s*(?:-|–|to)\s*\d{1,2}\s*years?\b/i) ??
    text.match(/\b(\d{1,2})\s*years?\b/i);
  if (!m) return null;
  const min = Number(m[1]);
  if (!Number.isFinite(min) || min <= 0 || min > 40) return null;
  const kind = /\bsenior\s+leadership|\bexecutive\b|\bc-?suite\b/i.test(text)
    ? "senior"
    : /\b(leadership|leading|lead|head|managerial|management\s+role|people\s+management)\b/i.test(
          text,
        )
      ? "leadership"
      : "any";
  return { min, kind };
}

export function evaluateYearsRequirement(
  text: string,
  cv: string,
  today: Date = new Date(),
): StructuredVerdict | null {
  const req = parseYearsRequirement(text);
  if (!req) return null;
  const marketingOnly = /\bmarketing\b/i.test(text);

  const roles = findDatedRanges(cv, today).filter((s) => !EDUCATION_LINE.test(s.line.text));
  let counted = roles;
  if (req.kind === "senior") counted = roles.filter((s) => SENIOR_TITLE.test(titleContext(cv, s)));
  else if (req.kind === "leadership")
    counted = roles.filter((s) => LEAD_TITLE.test(titleContext(cv, s)));
  // "marketing experience": count marketing roles when the CV's titles say so;
  // a CV whose titles carry no function words is read as a whole.
  if (marketingOnly) {
    const mk = counted.filter((s) => MARKETING_TITLE.test(titleContext(cv, s)));
    if (mk.length > 0) counted = mk;
  }

  if (counted.length === 0) {
    return {
      rule: "minimum_years",
      status: "unknown",
      needs_validation: true,
      note:
        roles.length === 0
          ? "No dated roles could be read from the CV. Confirm the years at screening."
          : "The dated roles do not show which were at this level. Confirm at screening.",
      evidence: [],
    };
  }

  const years = Math.round((unionMonths(counted) / 12) * 10) / 10;
  const evidence = counted
    .sort((a, b) => b.to - a.to)
    .slice(0, 3)
    .map((s) => quote(s.line, 160));
  const status: StructuredStatus =
    years >= req.min ? "met" : years >= req.min * 0.75 ? "partial" : "missing";
  const level =
    req.kind === "senior"
      ? " in senior leadership roles"
      : req.kind === "leadership"
        ? " in leadership roles"
        : "";
  return {
    rule: "minimum_years",
    status,
    needs_validation: status !== "met",
    note: `${years} years${level} from dated roles on the CV, against ${req.min} required.`,
    evidence,
  };
}

// ---------------------------------------------------------------------------

/** The first rule that recognises the requirement decides it; null means "not one of these shapes". */
export function evaluateStructuredRequirement(
  text: string,
  cv: string,
  today: Date = new Date(),
): StructuredVerdict | null {
  return (
    evaluateRelocationRequirement(text, cv) ??
    evaluateDegreeRequirement(text, cv) ??
    evaluateYearsRequirement(text, cv, today)
  );
}
