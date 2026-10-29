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

import { placesIn, regionsOf, REGION_TERMS, type Place, type Region } from "./geography";

export type StructuredStatus = "met" | "partial" | "missing" | "unknown";

export type StructuredEvidence = { snippet: string; start: number; end: number };

export type StructuredVerdict = {
  rule: "degree_field" | "conditional_relocation" | "minimum_years" | "market_experience";
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

/** Longer than this, a "line" is a flattened page rather than a line. */
const MAX_LINE = 280;
/** Where a flattened page can be cut: after a sentence, around a bullet or a bar. */
const SEGMENT_BREAK = /(?<=[.!?;])\s+(?=[A-Z0-9•▪●■◦·|-])|\s*[•▪●■◦|]\s*|\s+[·]\s+|\s{2,}/g;

/**
 * The CV as lines, with offsets into the original text.
 *
 * Many stored CVs have no line breaks at all: the PDF reader in production
 * joined every page into one line (fixed in cv-extractor, but the stored
 * text predates it). A rule that reads "the line" would then read the whole
 * CV as one line: every date sits next to "University", the header is the
 * whole document. A long line is therefore cut into segments at sentence
 * ends, bullets and bars, and anything still too long is wrapped at a space.
 */
function lines(cv: string): Line[] {
  const out: Line[] = [];
  const push = (text: string, start: number) => {
    const lead = text.length - text.trimStart().length;
    const t = text.trim();
    if (t) out.push({ text: t, start: start + lead, end: start + lead + t.length });
  };
  let pos = 0;
  for (const raw of cv.split("\n")) {
    const lineStart = pos;
    pos += raw.length + 1;
    if (raw.length <= MAX_LINE) {
      push(raw, lineStart);
      continue;
    }
    let from = 0;
    const pieces: Array<[number, number]> = [];
    for (const m of raw.matchAll(SEGMENT_BREAK)) {
      pieces.push([from, m.index!]);
      from = m.index! + m[0].length;
    }
    pieces.push([from, raw.length]);
    for (const [a, b] of pieces) {
      let s = a;
      while (b - s > MAX_LINE) {
        const cut = raw.lastIndexOf(" ", s + MAX_LINE);
        const at = cut > s ? cut : s + MAX_LINE;
        push(raw.slice(s, at), lineStart + s);
        s = at;
      }
      push(raw.slice(s, b), lineStart + s);
    }
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
    // The subject is what follows the degree, not the rest of the line: in a
    // CV stored as one line the "line" can run on into the next section, and
    // "BSc Civil Engineering ... Digital Marketing certificate" must not read
    // as a marketing degree.
    const levelRe =
      level === "bachelor" ? BACHELOR_RE : level === "master" ? MASTER_RE : PRO_DIPLOMA_RE;
    const hit = levelRe.exec(l.text);
    const at = hit?.index ?? 0;
    const skip = hit?.[0].length ?? 0;
    let own = l.text.slice(at, at + 90);
    // Stop at the next qualification after this one ("... MBA (Marketing)").
    const nextDegreeAt = own
      .slice(skip)
      .search(
        new RegExp(`${BACHELOR_RE.source}|${MASTER_RE.source}|${PRO_DIPLOMA_RE.source}`, "i"),
      );
    if (nextDegreeAt > 0) own = own.slice(0, skip + nextDegreeAt);
    own = own.split(/\s(?:19|20)\d{2}\b|\s[|•▪·]\s/)[0] ?? own;
    const subjectLine =
      next &&
      !nextIsDegree &&
      /^(major|minor|specialisation|specialization|concentration|field|subject)\b/i.test(next.text)
        ? `${own} ${next.text}`
        : own;
    // The degree abbreviations themselves (BBA, B.Com, MBA) name a business
    // subject; "B.Sc" and "BA" do not.
    const families = familiesIn(subjectLine);
    const unrelated = families.length === 0 && UNRELATED_SUBJECTS.test(subjectLine);
    out.push({
      level,
      families,
      unrelated,
      subjectless: families.length === 0 && !unrelated && isSubjectless(own),
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
    /\b(?:outside|based\s+in|located\s+in|living\s+in|resident\s+in)\s+(?:of\s+)?(?:the\s+)?([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,3})/,
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
  // Two wordings of one condition: "if outside X, willing to relocate" and
  // "based in X or willing to relocate". Either way, living there satisfies it.
  if (
    !/\b(if|unless|when)\b[^.]*\b(outside|not\s+(?:based|located|living|resident)|abroad|overseas)\b/i.test(
      text,
    ) &&
    !/\b(based|located|living|resident)\s+in\b[^.]*\bor\b[^.]*\breloca/i.test(text)
  )
    return null;
  const place = placePattern(text);
  return place ? { place } : null;
}

const LOCATION_LABEL =
  /^(?:📍\s*)?(location|address|based\s+in|current\s+location|residence|city|lives?\s+in)\b|^📍/i;

/** Where the candidate says they are now: an explicit location line, or a short header line. */
/**
 * Where the candidate says they are now, quoted as the place only ("Dubai,
 * UAE"): the phone number and email beside it are not evidence and must not
 * travel into a briefing.
 */
function candidateLocationLine(cv: string, place: RegExp): Line | null {
  const line = locationLine(cv, place);
  if (!line) return null;
  const m = line.text.match(place);
  if (!m) return line;
  const at = m.index ?? 0;
  // The place, then at most a country after it ("Dubai, UAE", "Dubai - UAE").
  const after = line.text
    .slice(at + m[0].length)
    .match(
      /^\s*[,\-–]\s*(?:U\.?A\.?E\.?|United\s+Arab\s+Emirates|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
    );
  const text = m[0] + (after?.[0] ?? "");
  return { text, start: line.start + at, end: line.start + at + text.length };
}

function locationLine(cv: string, place: RegExp): Line | null {
  const ls = lines(cv);
  // "Location: Dubai", or "based in Dubai" said of the person in a short line.
  // In a long sentence "based in" describes a project or an employer.
  const labelled = ls.find(
    (l) =>
      place.test(l.text) &&
      (LOCATION_LABEL.test(l.text) ||
        (l.text.length <= 120 &&
          new RegExp(
            `\\b(?:i\\s+am\\s+|currently\\s+)?based\\s+in\\s+(?:the\\s+)?(?:${place.source})`,
            "i",
          ).test(l.text))),
  );
  if (labelled) return labelled;
  // The CV header: the first lines, short ones only, so a summary sentence
  // about past work in Dubai is not read as where someone lives.
  const historyAt = cv.search(SECTION_START);
  const topEnd = Math.min(700, historyAt >= 0 ? historyAt : Infinity);
  const header = ls
    .slice(0, 8)
    .find(
      (l) =>
        l.text.length <= 120 &&
        place.test(l.text) &&
        (cv.includes("\n") || l.start + (l.text.match(place)?.index ?? 0) < topEnd),
    );
  if (header) return header;
  // The contact block: a place written beside a phone number, an email, a
  // LinkedIn link or a 📍 pin, before the work history starts. In a CV stored
  // as one line this is the only header there is
  // ("+971 … | name@… | LinkedIn | Dubai, UAE").
  const topLines = ls.filter((l) => l.start < topEnd);
  const contact = topLines.find((l, i) => {
    const m = l.text.match(place);
    if (!m || l.start + (m.index ?? 0) >= topEnd) return false;
    const at = m.index ?? 0;
    const around = [
      topLines[i - 1]?.text ?? "",
      l.text.slice(Math.max(0, at - 60), at + m[0].length + 40),
      topLines[i + 1]?.text ?? "",
    ].join(" ");
    return CONTACT_MARK.test(around);
  });
  return contact ?? null;
}

/** Where the work history or education begins: after it, a place is an employer's. */
const SECTION_START =
  /\b(?:WORK|PROFESSIONAL|CAREER|EMPLOYMENT)\s+(?:EXPERIENCE|HISTORY)\b|\b(?:Work|Professional|Career|Employment)\s+(?:Experience|History)\b|\bEXPERIENCE\b|\bEDUCATION\b/;

/** Signs of a contact block: a pin, a phone number, an email address, LinkedIn. */
const CONTACT_MARK =
  /📍|☎|📞|✉|\+\d{2,3}[\s\d-]{6,}|\S+@\S+\.\w+|linkedin|\b(?:tel|phone|mobile|email)\s*:/i;

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

/** The same pattern without the global flag, for a yes/no test. */
const DATE_RANGE = new RegExp(RANGE_RE.source, "i");

/** A dated range: months covered, its line, and where in the line it sits. */
type Span = { from: number; to: number; line: Line; at: number };

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
      if (to >= from && startYear >= 1960) out.push({ from, to, line: l, at: m.index });
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
  /\b(university|college|school|academy|institute|bachelors?|masters?|mba|degree|diploma|b\.?\s?sc|bsc|bba)\b/i;
const EDUCATION_HEADING = /\b(EDUCATION|QUALIFICATIONS|ACADEMIC|Education|Qualifications)\b/g;
const WORK_HEADING =
  /\b(EXPERIENCE|EMPLOYMENT|CAREER|Experience|Employment|Career Overview|Work History)\b/g;

/**
 * An education date rather than a role: the words just before the range name
 * a school or degree, or the nearest heading before it is Education. Judged at
 * the range itself, because one line of a stored CV can hold both sections.
 */
function isEducationSpan(s: Span): boolean {
  const before = s.line.text.slice(0, s.at);
  if (EDUCATION_LINE.test(before.slice(-80))) return true;
  const lastOf = (re: RegExp) => {
    let last = -1;
    for (const m of before.matchAll(re)) last = m.index ?? last;
    return last;
  };
  const edu = lastOf(EDUCATION_HEADING);
  return edu >= 0 && edu > lastOf(WORK_HEADING);
}
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

type YearsClaim = {
  years: number;
  kind: "any" | "leadership" | "senior";
  marketing: boolean;
  line: Line;
};

const CLAIM_RE = /\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/gi;
/** Words after a number that make it something other than a length of career. */
const NOT_A_DURATION =
  /^\W{0,3}(?:old|of\s+age|ago|gap|break|warranty|contract|guarantee|lease|plan|anniversary|celebration)\b|^-?\s*(?:old|gap)\b/i;

/**
 * Statements of career length in the CV's own words: "25+ years of retail
 * marketing experience", "16 years in leadership roles". A number counts only
 * when experience, a career or a field follows it; "a 10-year gap", "5 years
 * old" and "a 3-year contract" are not durations of experience.
 */
export function findYearsClaims(cv: string): YearsClaim[] {
  const out: YearsClaim[] = [];
  for (const l of lines(cv)) {
    for (const m of l.text.matchAll(CLAIM_RE)) {
      const after = l.text.slice(m.index! + m[0].length, m.index! + m[0].length + 90);
      if (NOT_A_DURATION.test(after)) continue;
      if (
        !/^\W{0,3}(?:of\s+)?(?:[\w&/,'’-]+\s+){0,6}?(?:experience|expertise|career|track\s+record|in\s+(?:the\s+)?(?:[\w&/-]+\s+){0,3}?(?:marketing|brand\w*|communications?|retail|leadership|management|industry|sector|roles?|positions?))\b/i.test(
          after,
        )
      )
        continue;
      const years = Number(m[1]);
      if (!Number.isFinite(years) || years <= 0 || years > 50) continue;
      const window = `${l.text.slice(Math.max(0, m.index! - 40), m.index!)} ${after}`;
      const kind = /\b(senior\s+leadership|executive|c-?suite|board)\b/i.test(window)
        ? "senior"
        : /\b(leadership|leading|led|managing|management|manager|head|director|team\s+lead)\b/i.test(
              window,
            )
          ? "leadership"
          : "any";
      out.push({ years, kind, marketing: MARKETING_TITLE.test(window), line: l });
    }
  }
  return out;
}

export function evaluateYearsRequirement(
  text: string,
  cv: string,
  today: Date = new Date(),
): StructuredVerdict | null {
  const req = parseYearsRequirement(text);
  if (!req) return null;
  const marketingOnly = /\bmarketing\b/i.test(text);

  // The CV's own statement of career length, for this kind of experience.
  const claim = findYearsClaims(cv)
    .filter((c) =>
      req.kind === "senior"
        ? c.kind === "senior"
        : req.kind === "leadership"
          ? c.kind !== "any"
          : !marketingOnly || c.marketing,
    )
    .sort((a, b) => b.years - a.years)[0];

  const dated = evaluateDatedYears(req, marketingOnly, cv, today);
  if (claim && claim.years >= req.min && dated.verdict.status !== "met") {
    // A stated career length counts when the dated roles do not contradict
    // it: no dates to check against, or dates that come close. When the dated
    // roles show far less ("11+ years" against roles dated from 2021), a
    // recruiter believes the dates: the claim lifts the row to partial at most.
    const datesAgree = dated.years === 0 || dated.years >= req.min * 0.75;
    const level =
      req.kind === "senior"
        ? " in senior leadership"
        : req.kind === "leadership"
          ? " in leadership"
          : "";
    return {
      rule: "minimum_years",
      status: datesAgree ? "met" : "partial",
      needs_validation: true,
      note: datesAgree
        ? `The CV states ${claim.years}+ years${level}, against ${req.min} required${
            dated.years > 0 ? `; dated roles on the CV show ${dated.years}` : ""
          }. Confirm at screening.`
        : `The CV states ${claim.years}+ years${level}, but dated roles show ${dated.years}, against ${req.min} required. Ask for the undated years.`,
      evidence: [quote(claim.line, 200), ...dated.verdict.evidence.slice(0, 2)],
    };
  }
  return dated.verdict;
}

type Requirement = { min: number; kind: "any" | "leadership" | "senior" };

/** Years from the dated roles on the CV, with the verdict those years give on their own. */
function evaluateDatedYears(
  req: Requirement,
  marketingOnly: boolean,
  cv: string,
  today: Date,
): { years: number; verdict: StructuredVerdict } {
  const roles = findDatedRanges(cv, today).filter((s) => !isEducationSpan(s));
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
      years: 0,
      verdict: {
        rule: "minimum_years",
        status: "unknown",
        needs_validation: true,
        note:
          roles.length === 0
            ? "No dated roles could be read from the CV. Confirm the years at screening."
            : "The dated roles do not show which were at this level. Confirm at screening.",
        evidence: [],
      },
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
    years,
    verdict: {
      rule: "minimum_years",
      status,
      needs_validation: status !== "met",
      note: `${years} years${level} from dated roles on the CV, against ${req.min} required.`,
      evidence,
    },
  };
}

// ---------------------------------------------------------------------------
// 4. Market experience: "Marketing experience in at least one of: South Korea,
//    Japan, Singapore, Hong Kong, China or Vietnam"
// ---------------------------------------------------------------------------

/**
 * Countries come from the shared geography dictionary (scoring/geography.ts):
 * every country a role is commonly hired for, with its common names,
 * abbreviations and business cities. Only places: never a nationality, a
 * language or a demonym, so "Korean national" or "speaks Japanese" can never
 * satisfy it. An adjective counts only directly before "market(s)".
 */
type Market = Place;

/** Lines about the person rather than their work. Never evidence of market experience. */
const PERSONAL_LINE =
  /\b(born|birth|nationality|citizen(?:ship)?|passport|native\s+of|hometown|ethnic|heritage|origin|visa\s+status|languages?)\b|\bnationals?\b(?=\s*(?:$|[,.;|)]))|\bnational\s+of\b/i;
/** A mention that is not operating in the market: study, a course, a trip, buying from it. */
const WEAK_CONTEXT =
  /\b(training|trained|course|workshop|seminar|conference|visit(?:ed)?|trip|exchange|studied|study\s+tour|university|college|school|degree|sourcing|sourced|source\s+markets?|suppliers?|supplier\s+negotiations?|import(?:ed|s)?\s+from|benchmark(?:ed|ing)?|knowledge\s+of|negotiat\w*|trading|traded|exports?\s+to|visitors?|tourists?|tourism|inbound|destination|partners?\s+(?:in|from))\b/i;
/**
 * Words that place the work in the market: a role there, a launch there, a
 * remit that names it. They must come shortly before the market's name.
 */
const OWNS_MARKET =
  /(?:based\s+in|located\s+in|relocated\s+to|lived\s+in|worked\s+in|launch(?:ed|ing)?\b[^.;]{0,40}\bin|entered|expan(?:ded|sion)\s+(?:in)?to|go-to-market\s+in|country\s+(?:manager|head|director|lead)\b[^.;]{0,30}|(?:head|director|vp|lead)\s+of\s+[^.;]{0,30}\b(?:for|in)|(?:led|managed|ran|owned)\s+[^.;]{0,50}\b(?:in|for|across)|markets?\s+(?:incl(?:uding|\.)?|such\s+as|across|covering)|responsib\w+\s+for\s+[^.;]{0,40})[\s,:(/-]*(?:[A-Z][\w.&-]*[\s,/-]+){0,4}$/i;

/** Work-authorisation and residence wording is about the person's status, not market experience. */
const NOT_MARKET_EXPERIENCE =
  /\b(eligible|eligibility|authori[sz]ed|authori[sz]ation|right\s+to\s+work|permit|visa|sponsor\w*|reloca\w*|based|located|residen\w*|living)\b/i;

/**
 * A requirement about operating in named markets.
 *
 * Two or more countries ("Korea, Japan or Singapore"; a group such as "the
 * GCC" counts as its members), or a single country named as a market ("the
 * Korean market", "experience in the UK"). A single location named only by a
 * city ("Experience in Dubai retail") or as where someone must live ("Based
 * in Dubai") is left to the relocation rule and the keyword matcher.
 */
export function parseMarketRequirement(text: string): { markets: Market[] } | null {
  if (!/\b(experience|experienced|worked|working|exposure|background|markets?)\b/i.test(text)) return null;
  const markets = placesIn(text);
  const countries = markets.filter((m) => m.region !== null);
  if (countries.length >= 2) {
    // "Eligible to work in the UK or the US" is authorisation, not experience.
    if (NOT_MARKET_EXPERIENCE.test(text) && !/\b(experience|exposure|background|markets?)\b/i.test(text))
      return null;
    return { markets };
  }
  if (countries.length !== 1) return null;
  const only = countries[0]!;
  if (!only.namedAsCountry(text)) return null;
  if (NOT_MARKET_EXPERIENCE.test(text)) return null;
  const asMarket =
    /\bmarkets?\b/i.test(text) ||
    /\b(experience|experienced|exposure|background|worked|working)\b[^.;]{0,40}?\b(in|within|across|for)\s+(?:the\s+)?\S/i.test(
      text,
    );
  return asMarket ? { markets } : null;
}

export function evaluateMarketRequirement(
  text: string,
  cv: string,
  today: Date = new Date(),
): StructuredVerdict | null {
  const req = parseMarketRequirement(text);
  if (!req) return null;
  const ls = lines(cv);
  const datedLines = new Set(findDatedRanges(cv, today).map((s) => s.line.start));
  const strong: Line[] = [];
  const weak: Line[] = [];
  ls.forEach((l) => {
    if (PERSONAL_LINE.test(l.text)) return;
    const hits = req.markets.flatMap((m) => m.indexes(l.text));
    if (hits.length === 0) return;
    // Indirect exposure anywhere on the line (training, sourcing, visitors
    // from the market) makes the line partial at most.
    if (WEAK_CONTEXT.test(l.text)) {
      weak.push(l);
      return;
    }
    // Met: the market sits in a dated role's own line (where the job was),
    // or the words just before it place the work there.
    // On a CV with real lines the role header is short and its dates sit on
    // it or the line beside it; in a flattened segment the date must be close.
    const idx = ls.indexOf(l);
    const besideDates =
      l.text.length <= 160 &&
      [ls[idx - 1], l, ls[idx + 1]].some((x) => x && datedLines.has(x.start));
    const inRole =
      besideDates ||
      (datedLines.has(l.start) &&
        hits.some((at) => DATE_RANGE.test(l.text.slice(Math.max(0, at - 90), at + 90))));
    const owned = hits.some((at) => OWNS_MARKET.test(l.text.slice(Math.max(0, at - 80), at)));
    (inRole || owned ? strong : weak).push(l);
  });
  const names = (found: Line[]) =>
    req.markets.filter((m) => found.some((l) => m.test(l.text))).map((m) => m.name);
  if (strong.length > 0) {
    return {
      rule: "market_experience",
      status: "met",
      needs_validation: false,
      note: `Worked in or for ${names(strong).join(", ")}.`,
      evidence: strong.slice(0, 3).map((l) => quote(l)),
    };
  }
  if (weak.length > 0) {
    return {
      rule: "market_experience",
      status: "partial",
      needs_validation: true,
      note: `Mentions ${names(weak).join(", ")}, but as training, sourcing or indirect exposure rather than working in the market. Confirm at screening.`,
      evidence: weak.slice(0, 2).map((l) => quote(l)),
    };
  }
  // A broad region that holds the named markets ("APAC" for Korea and
  // Japan, "EMEA" for Germany) is a question for screening, not evidence.
  const regions = regionsOf(req.markets);
  let regional: Line | undefined;
  let regionName: Region | undefined;
  for (const l of ls) {
    if (PERSONAL_LINE.test(l.text)) continue;
    regionName = regions.find((r) => REGION_TERMS[r].test(l.text));
    if (regionName) {
      regional = l;
      break;
    }
  }
  return {
    rule: "market_experience",
    status: "missing",
    needs_validation: Boolean(regional),
    note: regional
      ? `Mentions ${regionName} in general but none of the named markets. Ask which markets at screening.`
      : "None of the named markets appear in the CV.",
    evidence: regional ? [quote(regional)] : [],
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
    evaluateMarketRequirement(text, cv, today) ??
    evaluateDegreeRequirement(text, cv) ??
    evaluateYearsRequirement(text, cv, today)
  );
}
