import { normaliseLetterSpacing } from "./letter-spacing";

type Interval = { start: number; end: number };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// "Mar 2019", "Sept. 2019", "03/2019", "2019".
const DATE = "(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?\\s+|(?:0?[1-9]|1[0-2])[/.])?(?:19|20)\\d{2}";
// "–", "to", "till", "until", and "- Till" as some CVs write it.
const SEPARATOR = "(?:[–—-]\\s*(?:till|until|to)?|to|till|until)";
const OPEN_END = "present|current|now|ongoing|(?:till\\s+|to\\s+)?date";

function monthIndex(value: string, asOf: Date, isEnd: boolean): number | null {
  if (/^(present|current|now|ongoing|(?:till\s+|to\s+)?date)$/i.test(value.trim())) return asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  const numeric = value.trim().match(/^(\d{1,2})[/.]((?:19|20)\d{2})$/);
  if (numeric) {
    const mm = Number(numeric[1]) - 1;
    return mm >= 0 && mm <= 11 ? Number(numeric[2]) * 12 + mm : null;
  }
  const m = value.trim().match(/^(?:([A-Za-z]{3,9})\.?\s+)?((?:19|20)\d{2})$/);
  if (!m) return null;
  const month = m[1] ? MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) : (isEnd ? 11 : 0);
  if (month < 0) return null;
  return Number(m[2]) * 12 + month;
}

/** Headings that open a work history. */
const WORK_HEADINGS = [
  "Professional Experience", "Work Experience", "Career Experience", "Employment Experience",
  "Relevant Experience", "Professional History", "Work History", "Career History", "Employment History",
  "Career Overview", "Professional Background", "Employment Record", "Positions Held",
  "Experience", "Employment",
];
/** Headings that close it. */
const OTHER_HEADINGS = ["Education", "Qualifications", "Certifications", "Languages", "Skills", "Interests"];
const HEADING_WORDS = [...WORK_HEADINGS, ...OTHER_HEADINGS];
const isHeading = (line: string, list: string[]) => {
  const t = line.trim().replace(/\s*[:–-]\s*$/, "").replace(/\s+/g, " ").toLowerCase();
  return list.some((h) => h.toLowerCase() === t);
};
const HEADING = new RegExp(
  `\\b(${HEADING_WORDS.flatMap((w) => [w.toUpperCase(), w]).map((w) => w.replace(/ /g, "\\s+")).join("|")})\\b`,
  "g",
);

/** Words that make a date range a course of study, not a role. */
const SCHOOL =
  /\b(?:university|college|school|academy|institute|campus|faculty|bachelor'?s?|master'?s?|mba|degree|diploma|b\.?\s?sc|m\.?\s?sc|bba|phd|doctorate|doctor\s+of|gcse|hons)\b/i;
/**
 * Degree abbreviations and A levels, read in capitals so "ba", "ma" or "a
 * level" in a sentence are not taken for one. "Boston, MA" is a state, not a
 * degree.
 */
const DEGREE =
  /\b(?:B\.?A|(?<!,\s?)M\.?A|B\.?\s?Eng|M\.?\s?Eng|LL\.?B|LL\.?M|HN[CD]|B\.?\s?Com|M\.?\s?Com|A[\s-]?(?:Levels?|LEVELS?))\b/;
const isSchool = (s: string) => SCHOOL.test(s) || DEGREE.test(s);
const BULLET = /[•▪●◦■]/;

/**
 * A range whose own words name a school or degree: up to 60 characters either
 * side, within its line and not past a bullet (a bullet starts another
 * entry's description). A range alone on its line is read with the line
 * below, where a layout that puts dates first prints the degree.
 */
function nearSchool(body: string, start: number, end: number): boolean {
  const lineStart = body.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = (from: number) => {
    const nl = body.indexOf("\n", from);
    return nl < 0 ? body.length : nl;
  };
  const before = body
    .slice(Math.max(lineStart, start - 60), start)
    .split(BULLET)
    .pop();
  let after = body.slice(end, lineEnd(end));
  if (!/\p{L}/u.test(after) && lineEnd(end) < body.length) {
    after = body.slice(lineEnd(end) + 1, lineEnd(lineEnd(end) + 1));
  }
  after = after.slice(0, 60).split(BULLET)[0] ?? "";
  return isSchool(before ?? "") || isSchool(after);
}

const isBlank = (line: string) => !/[\p{L}\p{N}]/u.test(line);

/**
 * The first work heading with nothing under it before the next heading, or
 * -1. Two-column PDFs (Europass among them) are often extracted with the
 * column of section labels after the body: "… dated roles … ABOUT ME WORK
 * EXPERIENCE EDUCATION AND TRAINING …". The roles are then above their
 * heading, not under it.
 */
function detachedWorkHeading(lines: string[]): number {
  return lines.findIndex((line, i) => {
    if (!isHeading(line, WORK_HEADINGS)) return false;
    for (const next of lines.slice(i + 1)) {
      if (isHeading(next, HEADING_WORDS)) return true;
      if (!isBlank(next)) return false;
    }
    return true;
  });
}

/**
 * Where the body above a detached work heading ends: the start of the run of
 * section labels (and blank lines) that holds it. Not the first heading word
 * anywhere: a Title Case "Skills", "Languages" or "Qualifications" in the
 * profile is split onto its own line too, and cutting there would leave the
 * roles below it unread.
 */
function labelRunStart(lines: string[], at: number): number {
  let start = at;
  const isLabel = (line: string) => isBlank(line) || isHeading(line, HEADING_WORDS);
  while (start > 0 && isLabel(lines[start - 1] ?? "")) start--;
  return start;
}

/** Restrict intervals to employment sections; education dates are not roles. */
export function employmentIntervals(text: string, asOf = new Date()): Interval[] {
  const intervals: Interval[] = [];
  const pattern = new RegExp(`(${DATE})\\s*${SEPARATOR}\\s*(${DATE}|${OPEN_END})`, "gi");
  const compact = normaliseLetterSpacing(text).replace(/\b(?:[A-Z]\s+){3,}[A-Z]\b/g, (heading) => heading.replace(/\s/g, ""))
    .replace(/(PROFESSIONAL|WORK|CAREER|EMPLOYMENT)(EXPERIENCE|HISTORY)/g, "$1 $2");
  // Headings are written in capitals or title case. Matching the words in any
  // case made "skills" or "experience" in a sentence a section break, which
  // switched date reading off in the middle of a flattened CV's work history.
  const sections = compact.replace(HEADING, "\n$1\n");
  const lines = sections.split(/\r?\n/);
  let inEmployment = false;
  const now = asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  const read = (m: RegExpMatchArray) => {
    const start = monthIndex(m[1] ?? "", asOf, false);
    const end = monthIndex(m[2] ?? "", asOf, true);
    if (start !== null && end !== null && start <= now && end <= now && end >= start) {
      intervals.push({ start, end });
    }
  };
  for (const line of lines) {
    if (isHeading(line, WORK_HEADINGS)) inEmployment = true;
    if (isHeading(line, OTHER_HEADINGS)) inEmployment = false;
    if (!inEmployment) continue;
    for (const m of line.matchAll(pattern)) read(m);
  }
  // Headings extracted after the body: read the dated entries above the run
  // of section labels, leaving out courses of study. Only a CV with an empty
  // work heading and no dated role under a work heading gets here, so a CV
  // that already reads is never changed by it.
  const detached = intervals.length === 0 ? detachedWorkHeading(lines) : -1;
  if (detached >= 0) {
    const body = lines.slice(0, labelRunStart(lines, detached)).join("\n");
    for (const m of body.matchAll(pattern)) {
      const at = m.index ?? 0;
      // Part of a longer number (a phone or reference), not a date.
      if (/[\d/.]/.test(body[at - 1] ?? "") || /\d/.test(body[at + m[0].length] ?? "")) continue;
      if (nearSchool(body, at, at + m[0].length)) continue;
      read(m);
    }
  }
  return intervals;
}

export function yearsFromEmploymentDates(text: string, asOf = new Date()): number | null {
  const intervals = employmentIntervals(text, asOf).sort((a, b) => a.start - b.start);
  if (!intervals.length) return null;
  let months = 0;
  let current = intervals[0];
  if (!current) return null;
  for (const interval of intervals.slice(1)) {
    if (interval.start <= current.end + 1) current = { start: current.start, end: Math.max(current.end, interval.end) };
    else { months += current.end - current.start; current = interval; }
  }
  months += current.end - current.start;
  return Math.floor(months / 12);
}
