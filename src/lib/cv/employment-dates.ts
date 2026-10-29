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
  for (const line of lines) {
    if (isHeading(line, WORK_HEADINGS)) inEmployment = true;
    if (isHeading(line, OTHER_HEADINGS)) inEmployment = false;
    if (!inEmployment) continue;
    for (const m of line.matchAll(pattern)) {
      const start = monthIndex(m[1] ?? "", asOf, false);
      const end = monthIndex(m[2] ?? "", asOf, true);
      if (start !== null && end !== null && start <= now && end <= now && end >= start) intervals.push({ start, end });
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
