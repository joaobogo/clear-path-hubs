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
import { brandOriginsIn } from "./brand-origins";

import { parseYearsSubject, type YearsSubject } from "./years-subject";
import { homeStateOf, usStatesIn } from "./us-states";
import { HEADING_LINE } from "./non-evidence-lines";

export type StructuredStatus = "met" | "partial" | "missing" | "unknown";

export type StructuredEvidence = { snippet: string; start: number; end: number };

export type StructuredVerdict = {
  rule:
    | "degree_field"
    | "conditional_relocation"
    | "minimum_years"
    | "market_experience"
    | "onsite_attendance";
  status: StructuredStatus;
  needs_validation: boolean;
  /**
   * For a years verdict: what the count rests on. "described" means the roles
   * themselves show the subject; "titles" means job titles only; "stated" is
   * the CV's own "10+ years"; "none" means no role shows it.
   */
  years_basis?: "described" | "titles" | "stated" | "none";
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

export function evaluateRelocationRequirement(
  text: string,
  cv: string,
  profileLocation?: string | null,
): StructuredVerdict | null {
  const req = parseRelocationRequirement(text);
  if (!req) return null;
  let here = candidateLocationLine(cv, req.place);
  // The location the candidate gave on their profile, when the CV is silent.
  if (!here && profileLocation && req.place.test(profileLocation)) {
    const shown = `Profile location: ${profileLocation.trim()}`;
    here = { text: shown, start: 0, end: 0 };
  }
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
// A point in time: "Mar 2021", "2021", "3/2021", or a full date "10/18/21" or
// "10/18/2021" (US month/day/year, as many US CVs date every role). A full
// date's day is read and dropped; a two-digit year is resolved by
// fullDateYear. The full-date form comes before "3/2021" so "9/12/2022" is
// read as September 2022, not December 2022.
// A month may carry its day ("April 29, 2025"); the day is read and dropped
// (v1.7.8). The separator may be a dash followed by "to" ("03/2026 – to
// present"). Both forms used to leave the role unread.
const POINT = `(?:${MONTH_NAME}\\.?\\s+(?:\\d{1,2}(?:st|nd|rd|th)?,?\\s+)?['‘’]?)?((?:19|20)\\d{2}|(?<=[a-z]\\.?\\s+['‘’])\\d{2})(?!\\d)|(\\d{1,2})\\/(\\d{1,2})\\/((?:19|20)?\\d{2})(?!\\d)|(\\d{1,2})\\/((?:19|20)\\d{2})`;
const END = `(present|current|now|today|ongoing|to\\s+date|date)|${POINT}`;
const RANGE_RE = new RegExp(
  `(?<!['‘’\\d])(?:${POINT})\\s*(?:[-–—]\\s*(?:to|until|till)?|to|until|till)\\s*(?:${END})`,
  "gi",
);

/**
 * The year of a full date ("10/18/21"): four digits as written; two digits are
 * this century unless that would be in the future, then the last one.
 */
function fullDateYear(raw: string, today: Date): number {
  if (raw.length === 4) return Number(raw);
  const yy = Number(raw);
  const century = Math.floor(today.getUTCFullYear() / 100) * 100;
  return century + yy > today.getUTCFullYear() ? century - 100 + yy : century + yy;
}

/**
 * The month of a full date: US month/day order, unless the first number cannot
 * be a month ("18/10/21"), then day/month.
 */
function fullDateMonth(first: string, second: string): number {
  const a = Number(first);
  const b = Number(second);
  return (a >= 1 && a <= 12 ? a : b) - 1;
}

/** The same pattern without the global flag, for a yes/no test. */
const DATE_RANGE = new RegExp(RANGE_RE.source, "i");

/** A dated range: months covered, its line, and where in the line it sits. */
type Span = {
  from: number;
  to: number;
  line: Line;
  at: number;
  /** The range as written ("2002 – 2007", "July 2013 – October 2025"). */
  raw: string;
  /** Start or end written as a year alone, with no month. */
  yearOnlyFrom: boolean;
  yearOnlyTo: boolean;
  /** Open end ("Present"). */
  open: boolean;
  /**
   * A current role whose start year lost a digit ("April 202 – Present"). It
   * is a dated role with nothing to count: from and to are both today.
   */
  startUnreadable?: boolean;
  /** The end of a range cut by the line end: the next line and how much of it. */
  cont?: { lineStart: number; len: number };
};

/** A start with its dash at the end of a line: "… Medi-Corp Inc. (2015–". */
const RANGE_START_AT_EOL = new RegExp(`(?<!['‘’\\d])(?:${POINT})\\s*[-–—]\\s*$`, "i");
/** The end that opens the next line: "2019)Assistant Store Manager …". */
const RANGE_END_AT_BOL = new RegExp(`^(?:${END})`, "i");
/**
 * "April 202 – Present": a month, a year one digit short, and an open end.
 * Read as a current role whose start cannot be read, never as a guessed year.
 */
const TYPO_START_OPEN = new RegExp(
  `\\b${MONTH_NAME}\\.?\\s+(?:19|20)\\d(?!\\d)\\s*(?:[-–—]\\s*(?:to|until|till)?|to|until|till)\\s*(?:present|current|now|today|ongoing|to\\s+date)\\b`,
  "gi",
);

/** Month index since year 0, for arithmetic. */
function monthIndex(year: number, month: number): number {
  return year * 12 + month;
}

export function findDatedRanges(cv: string, today: Date = new Date()): Span[] {
  const now = monthIndex(today.getUTCFullYear(), today.getUTCMonth());
  const out: Span[] = [];
  const ls = lines(cv);
  const read = (m: RegExpExecArray, l: Line, at: number) => {
    // Groups (start): 1 month name, 2 year; 3 month, 4 day, 5 year of a
    // full date; 6 numeric month, 7 numeric year. 8 open end word. End:
    // 9 month name, 10 year; 11-13 full date; 14 numeric month, 15 year.
    const startYear = fullDateYear(m[5] ?? m[2] ?? m[7] ?? "", today);
    // A year alone ("2002 – 2007") is read January to December here, as it
    // always was. The roles a subject is counted from read it mid-year to
    // mid-year instead (midYear, v1.7.7).
    const yearOnlyFrom = !m[1] && !m[3] && !m[6];
    const startMonth = m[1]
      ? (MONTHS[m[1].slice(0, 3).toLowerCase()] ?? 0)
      : m[3]
        ? fullDateMonth(m[3], m[4])
        : m[6]
          ? Number(m[6]) - 1
          : 0;
    let to: number;
    let yearOnlyTo = false;
    if (m[8]) to = now;
    else {
      const endYear = fullDateYear(m[13] ?? m[10] ?? m[15] ?? "", today);
      yearOnlyTo = !m[9] && !m[11] && !m[14];
      const endMonth = m[9]
        ? (MONTHS[m[9].slice(0, 3).toLowerCase()] ?? 11)
        : m[11]
          ? fullDateMonth(m[11], m[12])
          : m[14]
            ? Number(m[14]) - 1
            : 11;
      to = Math.min(monthIndex(endYear, Math.min(Math.max(endMonth, 0), 11)), now);
    }
    const from = monthIndex(startYear, Math.min(Math.max(startMonth, 0), 11));
    if (to >= from && startYear >= 1960)
      out.push({
        from,
        to,
        line: l,
        at,
        raw: m[0],
        yearOnlyFrom,
        yearOnlyTo,
        open: Boolean(m[8]),
      });
  };
  ls.forEach((l, n) => {
    RANGE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RANGE_RE.exec(l.text)) !== null) read(m, l, m.index);
    // A range cut by the end of the line (v1.7.12): "(2015–" then "2019)" on
    // the next line is one period. A next line that opens with a whole range
    // of its own is left alone.
    const tail = RANGE_START_AT_EOL.exec(l.text);
    const next = ls[n + 1];
    const head = tail && next ? RANGE_END_AT_BOL.exec(next.text) : null;
    if (tail && next && head && DATE_RANGE.exec(next.text)?.index !== 0) {
      const joined = DATE_RANGE.exec(tail[0] + head[0]);
      if (joined && joined.index === 0) {
        const before = out.length;
        read(joined, l, tail.index);
        if (out.length > before)
          out[out.length - 1]!.cont = { lineStart: next.start, len: head[0].length };
      }
    }
    // A current role whose start year lost a digit (v1.7.12).
    TYPO_START_OPEN.lastIndex = 0;
    while ((m = TYPO_START_OPEN.exec(l.text)) !== null) {
      const at = m.index;
      if (out.some((s) => s.line === l && at < s.at + s.raw.length && s.at < at + m![0].length))
        continue;
      out.push({
        from: now,
        to: now,
        line: l,
        at,
        raw: m[0],
        yearOnlyFrom: false,
        yearOnlyTo: false,
        open: true,
        startUnreadable: true,
      });
    }
  });
  return out;
}

/**
 * A year written alone means "some time that year". Counted from mid-year to
 * mid-year, "2002 – 2007" is five years; January to December makes it six, a
 * year more than the person wrote. Used where a subject's years are counted
 * (v1.7.7): "5+ years of billing" from one role dated 2002 – 2007 is five
 * years, close to the minimum. Requirements with no subject keep the reading
 * their accepted scores were made with.
 */
function midYear(s: Span, today: Date): Span {
  if (!s.yearOnlyFrom && !s.yearOnlyTo) return s;
  const now = monthIndex(today.getUTCFullYear(), today.getUTCMonth());
  const startYear = Math.floor(s.from / 12);
  const endYear = Math.floor(s.to / 12);
  let from = s.yearOnlyFrom ? monthIndex(startYear, 6) : s.from;
  let to = s.yearOnlyTo && !s.open ? Math.min(monthIndex(endYear, 5), now) : s.to;
  // "2020 – 2020": part of one year, counted as half of it.
  if (s.yearOnlyFrom && s.yearOnlyTo && startYear === endYear) {
    from = monthIndex(startYear, 0);
    to = Math.min(monthIndex(startYear, 5), now);
  }
  // "2026 – Present" read early in 2026: started this year.
  if (from > to) from = monthIndex(startYear, 0);
  return { ...s, from, to };
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

/** A dated role with the lines that belong to it. */
export type RoleBlock = {
  span: Span;
  /** Title and employer: the dated line and the short lines around it. */
  header: string;
  /** What the person did there: the lines under the role, up to the next one. */
  body: string;
  /** Offsets of the body lines, for quoting. */
  bodyLines: Line[];
};

const BULLET_START = /^[•▪●■◦·\-*–—]/;

/** A short line with no sentence in it: a title, an employer, a place. */
function headerLike(l: Line | undefined): boolean {
  if (!l) return false;
  const t = l.text.replace(/[·•]\s*$/, "").trim();
  if (!t || t.length > 90 || BULLET_START.test(t)) return false;
  // A section heading or a page mark belongs to no role.
  // "Page 2", "Devon Inman – Curriculum Vitae Page 1 of 2": a page footer.
  if (HEADING_LINE.test(t) || /(?:^|\s)page\s+\d+(?:\s+of\s+\d+)?$/i.test(t)) return false;
  if (/[.;:,]$/.test(t)) return false;
  return t.split(/\s+/).length <= 12;
}

/**
 * The CV's dated roles as blocks (v1.7.7). The header is the dated line, up
 * to two short lines above it and one below; the body is every line from
 * there to the next role's header. Education dates are not roles.
 */
export function roleBlocks(cv: string, today: Date = new Date()): RoleBlock[] {
  const ls = lines(cv);
  const indexOf = new Map(ls.map((l, i) => [l.start, i] as const));
  const dated = findDatedRanges(cv, today)
    .filter((sp) => !isEducationSpan(sp))
    .map((sp) => ({ sp: midYear(sp, today), i: indexOf.get(sp.line.start) ?? -1 }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i || a.sp.at - b.sp.at);
  // A promotion chain under a role: "Billing Analyst (May 2016 – Sep 2017) →
  // Collections Analyst (Sep 2017 – Jul 2018) → …", two or more periods inside
  // the role's own, on the lines right under it with nothing between them.
  // They are that role's header, not new roles: the bullets below describe
  // the whole period.
  const spans: typeof dated = [];
  const chainEnd = new Map<number, number>();
  for (let k = 0; k < dated.length; k++) {
    const parent = dated[k]!;
    spans.push(parent);
    let last = parent.i;
    let n = k + 1;
    let run = 0;
    while (n < dated.length) {
      const c = dated[n]!;
      const gap = c.i - last;
      const inside = c.sp.from >= parent.sp.from - 1 && c.sp.to <= parent.sp.to + 1;
      if (!inside || (run === 0 ? gap < 1 || gap > 3 : gap > 1)) break;
      last = c.i;
      run++;
      n++;
    }
    if (run >= 2) {
      chainEnd.set(spans.length - 1, last);
      k = n - 1;
    }
  }
  const out: RoleBlock[] = [];
  // Where each role's header starts and its body starts.
  const bounds: { top: number; bodyFrom: number }[] = [];
  spans.forEach(({ i }, k) => {
    // A line the role above already took as its title is not this role's:
    // "COMPANY | dates" with the title underneath, and no bullets between.
    const prev = k > 0 ? Math.max(spans[k - 1]!.i, bounds[k - 1]!.bodyFrom - 1) : -1;
    let top = i;
    for (let up = 1; up <= 2 && i - up > prev; up++) {
      if (!headerLike(ls[i - up])) break;
      top = i - up;
    }
    const dateLineWords = ls[i]!.text.replace(DATE_RANGE, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const next = k + 1 < spans.length ? spans[k + 1]!.i : ls.length;
    // "COMPANY | 7/2024 – PRESENT" with the title on the next line.
    const below =
      i + 1 < next && headerLike(ls[i + 1]) && dateLineWords <= 6 && top === i ? i + 1 : i;
    bounds.push({ top, bodyFrom: Math.max(below, chainEnd.get(k) ?? -1) + 1 });
  });
  // Two jobs written on one line (v1.7.12): "Medical Biller — Foot & Ankle
  // Center (2019–2020)Medical Biller — Medi-Corp Inc. (2015–2019)". Each
  // period owns the words between the period before it and itself, so a title
  // counts for its own years only. Periods with no words between them
  // ("2010–2012, 2014–2016") still share the whole line.
  const onLineEnd = (x: { sp: Span; i: number }) =>
    Math.min(x.sp.at + x.sp.raw.length, ls[x.i]!.text.length);
  // "2019)Assistant Store Manager …": the "2019)" closes the period cut on the
  // line above. It is blanked (not removed, so positions hold) in headers.
  const contLen = new Map<number, number>();
  for (const { sp } of spans) if (sp.cont) contLen.set(sp.cont.lineStart, sp.cont.len);
  const textOf = (l: Line): string => {
    const n = contLen.get(l.start);
    if (!n) return l.text;
    const rest = l.text.slice(n);
    const close = /^[\s)\]]+/.exec(rest)?.[0].length ?? 0;
    return " ".repeat(n + close) + rest.slice(close);
  };
  const ownWords = (k: number): boolean =>
    k > 0 &&
    spans[k - 1]!.i === spans[k]!.i &&
    /[A-Za-z]{3,}/.test(ls[spans[k]!.i]!.text.slice(onLineEnd(spans[k - 1]!), spans[k]!.sp.at));
  spans.forEach(({ sp, i }, k) => {
    if (k > 0 && spans[k - 1]!.i === i) {
      // A second range on the same line: its own words, or the line's text.
      const header = ownWords(k)
        ? textOf(ls[i]!)
            .slice(onLineEnd(spans[k - 1]!), onLineEnd(spans[k]!))
            .replace(/^[\s)\]|,;:·•→>–—-]+/, "")
        : textOf(ls[i]!);
      out.push({ span: sp, header, body: "", bodyLines: [] });
      return;
    }
    const b = bounds[k]!;
    let end = ls.length;
    for (let n = k + 1; n < spans.length; n++) {
      if (spans[n]!.i !== i) {
        end = bounds[n]!.top;
        break;
      }
    }
    // The role ends where the next section starts: the last role on a CV
    // does not own the education and skills listed under it.
    for (let n = b.bodyFrom; n < end; n++) {
      const t = ls[n]!.text.trim();
      if (t.length <= 60 && HEADING_LINE.test(t)) {
        end = n;
        break;
      }
    }
    const headerLines = ls.slice(b.top, b.bodyFrom);
    const bodyLines = ls.slice(b.bodyFrom, Math.max(b.bodyFrom, end));
    out.push({
      span: sp,
      // The next job on the same line keeps its own words.
      header: headerLines
        .map((l) =>
          l === ls[i] && k + 1 < spans.length && spans[k + 1]!.i === i && ownWords(k + 1)
            ? textOf(l).slice(0, onLineEnd(spans[k]!))
            : textOf(l),
        )
        .join(" | "),
      // A wrapped line continues its bullet; a new bullet starts a new line.
      body: bodyLines
        .map((l, n) =>
          n === 0 ? l.text : /^[^A-Za-z0-9("'\s]/.test(l.text) ? `\n${l.text}` : ` ${l.text}`,
        )
        .join(""),
      bodyLines,
    });
  });
  return out;
}

/** "Center for Cancer and Blood Disorders 2002–2007": the role, named for a note. */
function roleLabel(b: RoleBlock): string {
  const name = b.header
    .replace(new RegExp(RANGE_RE.source, "gi"), " ")
    .replace(new RegExp(TYPO_START_OPEN.source, "gi"), " ")
    // A period removed from its brackets leaves "( )" or a lone bracket.
    .replace(/\(\s*\)|\(\s*(?:\d{4}\s*[-–—]\s*)?$|\(\s*(?=\|)/g, " ")
    .split("|")
    .map((x) => x.replace(/^[\s·•\-–—]+|[\s·•\-–—,]+$/g, "").trim())
    .filter(Boolean)
    .sort(
      (a, c) =>
        Number(/\d{5}|^[A-Z][a-z]+,\s*[A-Z]{2}$/.test(a)) -
        Number(/\d{5}|^[A-Z][a-z]+,\s*[A-Z]{2}$/.test(c)),
    )
    .slice(0, 2)
    .join(", ");
  const period = b.span.raw
    .replace(/\s*(?:[-–—]\s*(?:to\b|until\b|till\b)?|\bto\b|\buntil\b|\btill\b)\s*/i, "–")
    .replace(/\s+/g, " ");
  return `${name ? name.slice(0, 90) : "a role dated"} ${period}`.trim();
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
  // What the years are of (v1.7.7): a team managed, or the requirement's own
  // subject ("billing"). Marketing and leadership-level shapes keep their
  // title rules.
  const parsed = parseYearsSubject(text);
  const subject =
    parsed && (parsed.kind === "team" || (req.kind === "any" && !marketingOnly)) ? parsed : null;

  // The CV's own statement of career length, for this kind of experience.
  const claim = findYearsClaims(cv)
    .filter((c) =>
      subject
        ? subject.strong.test(c.line.text)
        : req.kind === "senior"
          ? c.kind === "senior"
          : req.kind === "leadership"
            ? c.kind !== "any"
            : !marketingOnly || c.marketing,
    )
    .sort((a, b) => b.years - a.years)[0];

  const dated = subject
    ? evaluateSubjectYears(req, subject, cv, today)
    : evaluateDatedYears(req, marketingOnly, cv, today);
  if (claim && claim.years >= req.min && dated.verdict.status !== "met") {
    // A stated career length counts when the dated roles do not contradict
    // it: no dates to check against, or dates that come close. When the dated
    // roles show far less ("11+ years" against roles dated from 2021), a
    // recruiter believes the dates: the claim lifts the row to partial at most.
    const datesAgree = (dated.years === 0 && !dated.hasRoles) || dated.years >= req.min * 0.75;
    const level = subject
      ? ` of ${subject.label}`
      : req.kind === "senior"
        ? " in senior leadership"
        : req.kind === "leadership"
          ? " in leadership"
          : "";
    return {
      rule: "minimum_years",
      status: datesAgree ? "met" : "partial",
      needs_validation: true,
      years_basis: "stated",
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

const oneDecimal = (months: number) => Math.round((months / 12) * 10) / 10;

/**
 * Years from the roles that show the requirement's subject (v1.7.7).
 *
 * A role counts in full when its own lines describe the subject (a team
 * managed, billing done). A title alone ("Manager", "Billing Analyst") is
 * weak: it can make the row partial, never met. The roles used are named in
 * the note so an admin can check the sum.
 */
function evaluateSubjectYears(
  req: Requirement,
  subject: YearsSubject,
  cv: string,
  today: Date,
): { years: number; hasRoles: boolean; verdict: StructuredVerdict } {
  const blocks = roleBlocks(cv, today);
  if (blocks.length === 0) {
    return {
      years: 0,
      hasRoles: false,
      verdict: {
        rule: "minimum_years",
        status: "unknown",
        needs_validation: true,
        note: "No dated roles could be read from the CV. Confirm the years at screening.",
        evidence: [],
      },
    };
  }
  const strong = blocks.filter((b) => subject.strong.test(b.body));
  const weak = blocks.filter((b) => !strong.includes(b) && subject.weak.test(b.header));
  const what = subject.kind === "team" ? "managing a team" : subject.label;
  if (strong.length === 0 && weak.length === 0) {
    return {
      years: 0,
      hasRoles: true,
      verdict: {
        rule: "minimum_years",
        status: "missing",
        needs_validation: true,
        years_basis: "none",
        note:
          blocks.length === 1
            ? `The one dated role on the CV does not show ${what}, against ${req.min} years required.`
            : `None of the ${blocks.length} dated roles on the CV shows ${what}, against ${req.min} years required.`,
        evidence: [],
      },
    };
  }
  const strongYears = oneDecimal(unionMonths(strong.map((b) => b.span)));
  const allYears = oneDecimal(unionMonths([...strong, ...weak].map((b) => b.span)));
  const byRecency = (a: RoleBlock, b: RoleBlock) => b.span.to - a.span.to;
  const named = (bs: RoleBlock[]) => {
    const sorted = [...bs].sort(byRecency);
    const shown = sorted.slice(0, 4).map(roleLabel).join("; ");
    return sorted.length > 4 ? `${shown}; and ${sorted.length - 4} more` : shown;
  };
  // Quote the line that shows the subject, most recent role first.
  const evidence: StructuredEvidence[] = [...strong]
    .sort(byRecency)
    .slice(0, 3)
    .map((b) => quote(b.bodyLines.find((l) => subject.strong.test(l.text)) ?? b.span.line, 200));
  for (const b of [...weak].sort(byRecency)) {
    if (evidence.length >= 3) break;
    evidence.push(quote(b.span.line, 160));
  }

  let status: StructuredStatus;
  let needs_validation: boolean;
  let years_basis: "described" | "titles";
  let note: string;
  if (strongYears >= req.min) {
    status = "met";
    years_basis = "described";
    // Half a year or less above the line: a recruiter confirms it.
    needs_validation = strongYears - req.min < 0.5;
    note = `${strongYears} yrs from: ${named(strong)}. Against ${req.min} required${
      needs_validation ? "; close to the minimum, confirm at screening" : ""
    }.`;
  } else if (allYears >= req.min * 0.75) {
    status = "partial";
    years_basis = "titles";
    needs_validation = true;
    note =
      strong.length > 0
        ? `${strongYears} yrs with ${what} described, from: ${named(strong)}.${
            weak.length > 0
              ? ` ${oneDecimal(unionMonths([...strong, ...weak].map((b) => b.span)) - unionMonths(strong.map((b) => b.span)))} more from a title alone (${named(weak)}).`
              : ""
          } Against ${req.min} required; confirm at screening.`
        : `${allYears} yrs from a title alone, with no ${subject.kind === "team" ? "team" : what} described: ${named(weak)}. Against ${req.min} required; confirm at screening.`;
  } else {
    status = "missing";
    years_basis = "titles";
    needs_validation = false;
    note = `${allYears} yrs from: ${named([...strong, ...weak])}. Against ${req.min} required.`;
  }
  // The subject described in a current role whose start year lost a digit
  // (v1.7.12): evidence with no length to count. At least partial, and a
  // recruiter confirms the dates.
  const unread = strong.find((b) => b.span.startUnreadable);
  if (unread && status !== "met") {
    status = "partial";
    needs_validation = true;
    const counted = strong.filter((b) => !b.span.startUnreadable);
    const subjectName = what.charAt(0).toUpperCase() + what.slice(1);
    note =
      `${subjectName} is described in a current role whose start date cannot be read on the CV: ${roleLabel(unread)}.` +
      (counted.length > 0
        ? ` ${oneDecimal(unionMonths(counted.map((b) => b.span)))} yrs more described, from: ${named(counted)}.`
        : "") +
      (weak.length > 0
        ? ` ${oneDecimal(unionMonths(weak.map((b) => b.span)))} yrs from a title alone (${named(weak)}).`
        : "") +
      ` Against ${req.min} required; confirm the dates at screening.`;
  }
  return {
    years: status === "met" ? strongYears : allYears,
    hasRoles: true,
    verdict: { rule: "minimum_years", status, needs_validation, years_basis, note, evidence },
  };
}

/** Years from the dated roles on the CV, with the verdict those years give on their own. */
function evaluateDatedYears(
  req: Requirement,
  marketingOnly: boolean,
  cv: string,
  today: Date,
): { years: number; hasRoles: boolean; verdict: StructuredVerdict } {
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
      hasRoles: false,
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
    hasRoles: true,
    verdict: {
      rule: "minimum_years",
      status,
      needs_validation: status !== "met" || counted.some((s) => s.startUnreadable),
      note: `${years} years${level} from dated roles on the CV, against ${req.min} required.${
        counted.some((s) => s.startUnreadable)
          ? " The start date of a current role cannot be read on the CV; confirm it at screening."
          : ""
      }`,
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
/** Indirect only in the sense of buying, studying or visiting: never lifted to met. */
const WEAK_ALWAYS =
  /\b(training|trained|course|workshop|seminar|conference|trip|exchange|studied|study\s+tour|university|college|school|degree|sourcing|sourced|suppliers?|supplier\s+negotiations?|import(?:ed|s)?\s+from|benchmark(?:ed|ing)?|knowledge\s+of|negotiat\w*|trading|traded)\b/i;
/** The brand is where the ads ran or the goods were listed, not what was marketed. */
const CHANNEL_BEFORE = /\b(on|via|through|across|using|platforms?|channels?)\b[^.;:]{0,40}$/i;
const CHANNEL_AFTER =
  /^['’]?s?\s*(ads?|advertising|shop|store|marketplace|app|platform|listings?)\b/i;
/**
 * Marketing aimed at the market's own consumers ("campaigns targeting Chinese
 * source markets", "roadshows for Japanese travellers") is marketing into
 * that market, which the requirement counts.
 */
const MARKETING_INTO =
  /\b(campaigns?|roadshows?|targeted|targeting|aimed\s+at|activations?|advertis\w+|promot\w+|go-to-market|launch(?:ed|es|ing)?)\b/i;
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
  if (!/\b(experience|experienced|worked|working|exposure|background|markets?)\b/i.test(text))
    return null;
  const markets = placesIn(text);
  const countries = markets.filter((m) => m.region !== null);
  if (countries.length >= 2) {
    // "Eligible to work in the UK or the US" is authorisation, not experience.
    if (
      NOT_MARKET_EXPERIENCE.test(text) &&
      !/\b(experience|exposure|background|markets?)\b/i.test(text)
    )
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
    // from the market) makes the line partial at most, unless the line is
    // marketing aimed at that market's consumers.
    if (WEAK_CONTEXT.test(l.text)) {
      (!WEAK_ALWAYS.test(l.text) && MARKETING_INTO.test(l.text) ? strong : weak).push(l);
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
  // Marketing for a company or brand from the market (Nissan for Japan,
  // Haier for China) is experience of that market wherever the work was done.
  const wanted = new Set(req.markets.map((m) => m.name));
  const branded: Array<{ line: Line; brand: string; country: string }> = [];
  const brandedWeak: Line[] = [];
  for (const l of ls) {
    if (PERSONAL_LINE.test(l.text)) continue;
    const found = brandOriginsIn(l.text).filter((b) => wanted.has(b.country));
    if (found.length === 0) continue;
    // A brand named as a channel ("campaigns on Samsung's platform", "ads
    // across Sony devices") is a tool the person used, not a brand they
    // marketed: weak, like sourcing.
    const marketed = found.filter((b) => {
      const before = l.text.slice(Math.max(0, b.index - 40), b.index);
      const after = l.text.slice(b.index + b.brand.length, b.index + b.brand.length + 24);
      return !CHANNEL_BEFORE.test(before) && !CHANNEL_AFTER.test(after);
    });
    if (WEAK_ALWAYS.test(l.text) || marketed.length === 0) brandedWeak.push(l);
    else branded.push(...marketed.map((b) => ({ line: l, brand: b.brand, country: b.country })));
  }
  if (branded.length > 0) {
    const shown = [...new Map(branded.map((b) => [b.brand.toLowerCase(), b])).values()].slice(0, 3);
    return {
      rule: "market_experience",
      status: "met",
      needs_validation: false,
      note: `Marketed ${shown.map((b) => `${b.brand} (${b.country})`).join(", ")}: brands from the named markets.`,
      evidence: [...new Set(shown.map((b) => b.line))].map((l) => quote(l)),
    };
  }
  if (weak.length > 0 || brandedWeak.length > 0) {
    const all = [...weak, ...brandedWeak];
    return {
      rule: "market_experience",
      status: "partial",
      needs_validation: true,
      note: `Mentions ${[
        ...new Set([
          ...names(all),
          ...brandedWeak.flatMap((l) =>
            brandOriginsIn(l.text)
              .filter((b) => wanted.has(b.country))
              .map((b) => b.country),
          ),
        ]),
      ].join(
        ", ",
      )}, but as training, sourcing or indirect exposure rather than marketing for the market. Confirm at screening.`,
      evidence: all.slice(0, 2).map((l) => quote(l)),
    };
  }
  // A broad region that holds the named markets ("APAC" for Korea and
  // Japan) is real but unnamed exposure: partial, with the markets asked
  // about at screening.
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
  if (regional) {
    return {
      rule: "market_experience",
      status: "partial",
      needs_validation: true,
      note: `Works across ${regionName} without naming one of the markets. Ask which markets at screening.`,
      evidence: [quote(regional)],
    };
  }
  return {
    rule: "market_experience",
    status: "missing",
    needs_validation: false,
    note: "None of the named markets, or brands from them, appear in the CV.",
    evidence: [],
  };
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 5. On-site attendance: "Able to work from the Woodbridge, New Jersey office
//    at least 3 days a week" (v1.7.7)
// ---------------------------------------------------------------------------

const ONSITE_REQUIREMENT =
  /\b(?:able|willing|available|required|expected|prepared|happy)\s+to\s+(?:work|commute|be|attend|travel)\b[^.]{0,80}\b(?:office|on[-\s]?site|onsite|in[-\s]person|premises)\b|\bwork\s+(?:from|at|in)\s+(?:the|our)\s+[^.]{2,60}\boffice\b|\b(?:on[-\s]?site|in[-\s]office|in\s+the\s+office|office[-\s]based)\b[^.]{0,60}\b\d\s*\+?\s*days?\s+(?:a|per|each)\s+week\b|\b\d\s*\+?\s*days?\s+(?:a|per|each)\s+week\b[^.]{0,60}\b(?:on[-\s]?site|in\s+the\s+office|in[-\s]office|at\s+(?:the|our)\s+[^.]{0,40}office)\b/i;

/**
 * Attendance at a named office is a question of where the person lives, not
 * of CV wording: "new", "office" and "days" were matched against Microsoft
 * Office and New York. Home inside the office's state is met; a home
 * elsewhere, or none stated, is for the recruiter to confirm, and the
 * candidate's own yes then makes it partial in the engine's answer step.
 * Only a requirement that names a US state is read here.
 */
export function evaluateOnsiteRequirement(
  text: string,
  cv: string,
  profileLocation?: string | null,
): StructuredVerdict | null {
  if (!ONSITE_REQUIREMENT.test(text)) return null;
  const office = usStatesIn(text)[0];
  if (!office) return null;
  // Home: the profile's location, else the contact block at the top of the CV.
  const contact = lines(cv)
    .slice(0, 8)
    .find((l) => homeStateOf(l.text) !== null && !DATE_RANGE.test(l.text));
  // "Scotch Plains, NJ, USA, Scotch Plains, USA": the profile's fields joined.
  const profile = [
    ...new Map(
      (profileLocation ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => [x.toLowerCase(), x] as const),
    ).values(),
  ].join(", ");
  // The line quoted is the one the state was read from: a profile that says
  // "Newark, US" leaves the state to the CV's own contact line.
  const fromProfile = profile
    ? {
        text: `Profile location: ${profile}`,
        state: homeStateOf(profileLocation),
        start: 0,
        end: 0,
      }
    : null;
  const fromCv = contact
    ? {
        text: contact.text,
        state: homeStateOf(contact.text),
        start: contact.start,
        end: contact.end,
      }
    : null;
  const home = fromProfile?.state ? fromProfile : fromCv?.state ? fromCv : (fromProfile ?? fromCv);
  const homeState = home?.state ?? null;
  if (home && homeState && homeState.code === office.code) {
    return {
      rule: "onsite_attendance",
      status: "met",
      needs_validation: false,
      note: `Home is in ${office.name}, the same state as the office.`,
      evidence: [
        {
          snippet: home.text.length > 200 ? `${home.text.slice(0, 199)}…` : home.text,
          start: home.start,
          end: home.end,
        },
      ],
    };
  }
  return {
    rule: "onsite_attendance",
    status: "unknown",
    needs_validation: true,
    note: homeState
      ? `Home is in ${homeState.name}; the office is in ${office.name}. Confirm the commute at screening.`
      : "Home location is not stated. Confirm the commute at screening.",
    evidence: [],
  };
}

/** The first rule that recognises the requirement decides it; null means "not one of these shapes". */
export function evaluateStructuredRequirement(
  text: string,
  cv: string,
  today: Date = new Date(),
  opts: { profileLocation?: string | null } = {},
): StructuredVerdict | null {
  return (
    evaluateRelocationRequirement(text, cv, opts.profileLocation) ??
    evaluateOnsiteRequirement(text, cv, opts.profileLocation) ??
    evaluateMarketRequirement(text, cv, today) ??
    evaluateDegreeRequirement(text, cv) ??
    evaluateYearsRequirement(text, cv, today)
  );
}
