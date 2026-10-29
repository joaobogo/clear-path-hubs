type Interval = { start: number; end: number };
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE = "(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+)?(?:19|20)\\d{2}";

function monthIndex(value: string, asOf: Date, isEnd: boolean): number | null {
  if (/^(present|current|now|ongoing)$/i.test(value.trim())) return asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  const m = value.trim().match(/^(?:([A-Za-z]{3,9})\s+)?((?:19|20)\d{2})$/);
  if (!m) return null;
  const month = m[1] ? MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) : (isEnd ? 11 : 0);
  if (month < 0) return null;
  return Number(m[2]) * 12 + month;
}

/** Restrict intervals to employment sections; education dates are not roles. */
export function employmentIntervals(text: string, asOf = new Date()): Interval[] {
  const intervals: Interval[] = [];
  const pattern = new RegExp(`(${DATE})\\s*(?:[–—-]|to)\\s*(${DATE}|present|current|now|ongoing)`, "gi");
  const compact = text.replace(/\b(?:[A-Z]\s+){3,}[A-Z]\b/g, (heading) => heading.replace(/\s/g, ""))
    .replace(/(PROFESSIONAL|WORK|CAREER|EMPLOYMENT)(EXPERIENCE|HISTORY)/g, "$1 $2");
  const sections = compact.replace(/\b((?:PROFESSIONAL|WORK|CAREER|EMPLOYMENT)\s+(?:EXPERIENCE|HISTORY)|EXPERIENCE|EMPLOYMENT|EDUCATION|QUALIFICATIONS|CERTIFICATIONS|LANGUAGES|SKILLS|INTERESTS)\b/gi, "\n$1\n");
  const lines = sections.split(/\r?\n/);
  let inEmployment = false;
  const now = asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  for (const line of lines) {
    if (/^\s*(?:professional |work |career |employment )?(?:experience|history)\s*[:–-]?\s*$/i.test(line) || /^\s*employment\s*[:–-]?\s*$/i.test(line)) inEmployment = true;
    if (/^\s*(education|qualifications|certifications|languages|skills|interests)\s*[:–-]?\s*$/i.test(line)) inEmployment = false;
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
