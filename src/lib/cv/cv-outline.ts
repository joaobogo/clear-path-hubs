/**
 * A CV read without a model (parser fallback, scoring v1.7.7).
 *
 * When the AI gateway is unavailable the profile used to be filled by a
 * few regexes: no work history, no education, and the "headline" was the
 * first short line under the name, which on a CV with a postal address is
 * the street ("245 Golf Avenue E"). This reads the same text the scorer
 * reads: dated roles become the work history, the education section becomes
 * education, and the headline is a line that describes work, or the most
 * recent job title.
 *
 * Everything is copied from the CV. Nothing is inferred or reworded.
 */
import { HEADING_LINE, STREET_ADDRESS } from "@/lib/scoring/non-evidence-lines";
import { roleBlocks, type RoleBlock } from "@/lib/scoring/structured-requirements";

export type OutlineRole = {
  company: string;
  title: string;
  start: string;
  end: string;
  summary: string;
};
export type OutlineEducation = { school: string; degree: string; field: string; year: string };
export type CvOutline = {
  full_name: string | null;
  headline: string | null;
  summary: string | null;
  experience: OutlineRole[];
  education: OutlineEducation[];
};

const CONTACT =
  /@|\blinkedin\.com\b|https?:\/\/|\bwww\.|\b(?:tel|phone|mobile|cell|e-?mail|fax)\b\s*[:.]?|\d{3}[\s.)-]+\d{3,4}|\d{5}/i;
const CITY_STATE =
  /^[A-Za-z .'-]{2,40},\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?(?:\s*,\s*(?:USA|US|United States))?$/;
/** Words a job title is built from. */
const TITLE_WORD =
  /\b(manager|supervisor|director|lead|leader|head|chief|officer|president|partner|principal|accountant|bookkeeper|biller|controller|auditor|analyst|specialist|coordinator|administrator|assistant|associate|clerk|representative|consultant|advisor|adviser|engineer|developer|designer|architect|technician|operator|driver|nurse|teacher|recruiter|paralegal|attorney|counsel|secretary|receptionist|cashier|agent|intern|trainee|executive|owner|founder|planner|buyer|strategist|scientist|researcher|editor|writer|collector|picker|packer|harvester|labourer|laborer)\b/i;
const DEGREE =
  /\b(bachelor(?:'s|s)?|master(?:'s|s)?|associate(?:'s|s)?|doctor(?:ate)?|ph\.?\s?d|mba|m\.?b\.?a|b\.?sc?|b\.?a|m\.?sc?|m\.?a|llb|llm|j\.?d|diploma|postgraduate|graduate\s+certificate|degree|bacharel(?:ado)?|licenciatura|mestrado|tecn[oó]logo)\b/i;
const MONTH =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?/gi;
/** A degree written out, as opposed to an abbreviation that is also a word or a product. */
const LONG_DEGREE =
  /\b(bachelor(?:'s|’s|s)?|master(?:'s|’s|s)?|associate(?:'s|’s|s)?|doctor(?:ate)?|ph\.?\s?d|mba|diploma|postgraduate|graduate\s+certificate|degree|bacharel(?:ado)?|licenciatura|mestrado|tecn[oó]logo|llb|llm)\b/i;
const SCHOOL =
  /\b(university|universidade|universidad|college|institute|instituto|school|academy|faculdade|polytechnic|puc|fgv|senac|usp)\b/i;

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/(^|[\s'’-])([a-zà-ÿ])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** The person's name: the first line that is two to five name-like words. */
function findName(top: string[]): { name: string; at: number } | null {
  for (let i = 0; i < top.length; i++) {
    // "William Coshburn MBA 13 Jade Meadow Drive…": the name is what comes before the address.
    const line = top[i]!.replace(/\s+\d.*$/, "")
      .replace(/[,|].*$/, "")
      .trim();
    if (!line || line.length > 60 || /[@\d]/.test(line) || HEADING_LINE.test(line)) continue;
    const words = line
      .split(/\s+/)
      .filter((w) => !/^(?:mba|cpa|phd|msc|bsc|jr\.?|sr\.?|ii|iii)$/i.test(w));
    if (words.length < 2 || words.length > 5) continue;
    const mixed = words.every((w) => /^[A-ZÀ-Ý][a-zà-ÿ'’.-]*$/.test(w));
    // A CV that writes the name in capitals: "RENEE C. CODY".
    const capitals = words.every((w) => /^[A-ZÀ-Ý][A-ZÀ-Ý'’.-]*$/.test(w));
    if (!mixed && !capitals) continue;
    if (TITLE_WORD.test(line)) continue;
    return { name: capitals ? titleCase(words.join(" ")) : words.join(" "), at: i };
  }
  return null;
}

/** A line that can head a profile: about the work, not where to post a letter. */
export function isHeadlineLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 90) return false;
  if (CONTACT.test(t) || STREET_ADDRESS.test(t) || CITY_STATE.test(t) || HEADING_LINE.test(t))
    return false;
  // An address written without a street word, a date, a page mark.
  if (/^\d/.test(t) || /\d{4}/.test(t) || /^page\s+\d+/i.test(t)) return false;
  // A sentence is a summary, not a headline.
  if (/[.!?]$/.test(t) && t.split(/\s+/).length > 8) return false;
  return /[A-Za-z]{3}/.test(t);
}

function splitPeriod(raw: string): { start: string; end: string } {
  const m = raw
    .trim()
    .match(/^(.+?)\s*(?:[-–—]\s*(?:to\b|until\b|till\b)?|\bto\b|\buntil\b|\btill\b)\s*(.+)$/i);
  return m ? { start: m[1]!.trim(), end: m[2]!.trim() } : { start: raw.trim(), end: "" };
}

const clean = (s: string) =>
  s
    .replace(/^[\s·•|,;:()\-–—]+|[\s·•|,;:(\-–—]+$/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Title and employer from the lines that head a role. */
export function titleAndCompany(b: RoleBlock): { title: string; company: string } {
  const withoutDates = b.header.split(b.span.raw).join(" ");
  const parts = withoutDates
    .split(/\s*\|\s*|\s+[–—-]\s+|-\s+(?=[A-Z])|\s{3,}/)
    .map(clean)
    .filter((p) => p && !CITY_STATE.test(p) && !/^(?:usa|united states|remote|hybrid)$/i.test(p));
  if (parts.length === 0) return { title: "", company: "" };
  let titleAt = parts.findIndex((p) => TITLE_WORD.test(p));
  if (titleAt < 0) titleAt = 0;
  let title = parts[titleAt]!;
  let company = parts.find((_p, i) => i !== titleAt) ?? "";
  // "Billing Manager, Integrity, Inc.": title, then employer, on one line.
  const comma = title.indexOf(", ");
  if (
    !company &&
    comma > 0 &&
    TITLE_WORD.test(title.slice(0, comma)) &&
    !TITLE_WORD.test(title.slice(comma + 2))
  ) {
    company = clean(title.slice(comma + 2));
    title = clean(title.slice(0, comma));
  }
  return { title, company };
}

function sectionLines(all: string[], heading: RegExp): string[] {
  const from = all.findIndex((l) => l.length <= 60 && heading.test(l.trim()));
  if (from < 0) return [];
  const out: string[] = [];
  for (let i = from + 1; i < all.length; i++) {
    const t = all[i]!.trim();
    if (t.length <= 60 && HEADING_LINE.test(t)) break;
    if (t) out.push(t);
  }
  return out;
}

function parseEducation(all: string[]): OutlineEducation[] {
  const out: OutlineEducation[] = [];
  const ls = sectionLines(all, /^education(?:\s*(?:&|and)\s*certifications)?\s*:?$/i);
  for (let i = 0; i < ls.length && out.length < 6; i++) {
    let line = ls[i]!.replace(/^[•▪●■◦·\-*–—]\s*/, "");
    // Certificates listed under a degree are not degrees: "Certifications by
    // Brainbench: … MS Word 2007" was stored as a degree called MS.
    if (/^(?:certifications?|certificates?|courses?|training|licen[cs]es?)\b/i.test(line)) break;
    if (!DEGREE.test(line) || /^professional development\b/i.test(line)) continue;
    // A bare abbreviation (MS, BA, MA) is a degree only beside a school.
    const schoolNear = SCHOOL.test(line) || SCHOOL.test(ls[i + 1] ?? "");
    if (!LONG_DEGREE.test(line) && !schoolNear) continue;
    // A line that breaks mid-phrase continues on the next one.
    if (/\b(?:and|of|in|&)\s*$/i.test(line) && ls[i + 1] && !DEGREE.test(ls[i + 1]!)) {
      line = `${line} ${ls[i + 1]!}`;
    }
    // "MBA, Business Intelligence 2023" with the school on the next line.
    const next = ls[i + 1] && !DEGREE.test(ls[i + 1]!) && SCHOOL.test(ls[i + 1]!) ? ls[i + 1]! : "";
    const year = (line.match(/\b(?:19|20)\d{2}\b(?!.*\b(?:19|20)\d{2}\b)/) ?? [""])[0];
    const pieces = line
      .replace(/\b(?:19|20)\d{2}\b/g, " ")
      .replace(MONTH, " ")
      .split(/\s*[,|]\s*|\s+[–—-]\s+/)
      .map(clean)
      .filter(Boolean);
    const schoolPiece = pieces.find((p) => SCHOOL.test(p) && !DEGREE.test(p)) ?? "";
    // The degree starts at its own word: "LT in bachelor's degree in business
    // administration" is a bachelor's degree, not a degree called LT.
    const rawDegree = pieces.find((p) => DEGREE.test(p)) ?? "";
    const at = rawDegree.search(LONG_DEGREE);
    const degreePiece = at > 0 ? rawDegree.slice(at) : rawDegree;
    const m = degreePiece.match(/^(.*?)\s+in\s+(.+)$/i);
    const degree = m ? clean(m[1]!) : degreePiece;
    const field = m
      ? clean(m[2]!)
      : (pieces.find((p) => p !== rawDegree && p !== schoolPiece) ?? "");
    const nextSchool =
      next
        .split(/\s*[,|]\s*|\s+[–—-]\s+/)
        .map(clean)
        .find((p) => SCHOOL.test(p)) ?? "";
    const school = schoolPiece || nextSchool;
    // A flattened line that ran two entries together is left out, not guessed at.
    if (!degree || degree.split(/\s+/).length > 8 || school.split(/\s+/).length > 7) continue;
    out.push({ school, degree, field: field.split(/\s+/).length > 8 ? "" : field, year });
  }
  return out;
}

/** The CV's own structure: name, headline, work history and education. */
export function outlineCv(cvText: string, today: Date = new Date()): CvOutline {
  const text = cvText.replace(/\r\n/g, "\n");
  const all = text.split("\n");
  const top = all
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);
  const found = findName(top);

  const blocks = roleBlocks(text, today)
    .filter((b) => b.body.trim() || b.header.split(b.span.raw).join("").trim())
    .sort((a, b) => b.span.to - a.span.to || b.span.from - a.span.from);
  const experience: OutlineRole[] = [];
  for (const b of blocks) {
    const { title, company: employer } = titleAndCompany(b);
    if (!title && !employer) continue;
    // Dates left in the heading mean two roles ran together; a school with a
    // degree is study, not a job. Both are left out rather than guessed at.
    if (/\b(?:19|20)\d{2}\b/.test(`${title} ${employer}`) || HEADING_LINE.test(title)) continue;
    if (SCHOOL.test(b.header) && DEGREE.test(b.header) && !TITLE_WORD.test(b.header)) continue;
    // A wrapped bullet above the role is not its employer.
    // Nor is the candidate's own name, repeated in a page header or footer.
    const own = found ? employer.toLowerCase().startsWith(found.name.toLowerCase()) : false;
    const company = /^[A-ZÀ-Ý0-9]/.test(employer) && !own ? employer : "";
    const { start, end } = splitPeriod(b.span.raw);
    const summary = b.body
      .split("\n")
      .map((l) =>
        l
          .replace(/^[•▪●■◦·\-*–—]\s*/, "")
          .replace(/[·•]\s*$/, "")
          .trim(),
      )
      .filter(Boolean)
      .join(" ")
      .slice(0, 500);
    experience.push({ company, title, start, end, summary });
    if (experience.length >= 12) break;
  }

  // The headline is a line under the name that describes the work. A CV with
  // none (name, address, phone) takes the most recent job title.
  let headline: string | null = null;
  if (found) {
    for (let i = found.at + 1; i < Math.min(found.at + 5, top.length); i++) {
      const l = top[i]!;
      if (HEADING_LINE.test(l)) break;
      // A wrapped contact line ("the U.S.") is not a headline: it names the work.
      if (!isHeadlineLine(l) || !TITLE_WORD.test(l)) continue;
      headline = clean(l.split("|")[0]!);
      break;
    }
  }
  if (!headline) headline = experience[0]?.title || null;

  const summaryLines = sectionLines(
    all,
    /^(?:professional\s+|career\s+)?(?:summary|profile)\s*:?$|^about me\s*:?$/i,
  );
  const summaryText = summaryLines.join(" ").replace(/\s+/g, " ").trim();
  const summary = summaryText.length >= 80 ? summaryText.slice(0, 600) : null;

  return {
    full_name: found?.name ?? null,
    headline,
    summary,
    experience,
    education: parseEducation(all),
  };
}
