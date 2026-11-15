/**
 * Parts of a CV that are not evidence of doing anything (v1.7.7).
 *
 * The keyword search read every line, so a requirement about "engagement
 * terms" quoted "Active member of several Employee Engagement groups", a
 * requirement about "busy professionals" matched the heading "PROFESSIONAL
 * EXPERIENCE", and "billing" was found in an objective statement ("To obtain
 * an AR and Billing management position"). None of those lines says what the
 * person has done.
 *
 * maskNonQuotableLines returns the text with those parts blanked by spaces:
 * same length, same offsets, so quotes and negation still read the CV as
 * written. Only the keyword search reads this copy; the recruiter-style
 * rules (dates, degrees, location) keep the headings they navigate by.
 */

const HEADINGS = [
  "professional experience",
  "professional summary",
  "professional profile",
  "professional background",
  "professional development",
  "work experience",
  "work history",
  "employment history",
  "employment",
  "career summary",
  "career objective",
  "career history",
  "career profile",
  "career highlights",
  "experience",
  "additional experience",
  "previous work experience",
  "relevant experience",
  "summary",
  "profile",
  "objective",
  "objectives",
  "about me",
  "personal statement",
  "skills",
  "core skills",
  "key skills",
  "technical skills",
  "computer skills",
  "core competencies",
  "core skills & competencies",
  "skills & competencies",
  "areas of expertise",
  "competencies",
  "education",
  "education & certifications",
  "education and certifications",
  "certifications",
  "qualifications",
  "training",
  "languages",
  "references",
  "interests",
  "hobbies",
  "volunteering",
  "systems & technology",
  "systems",
  "tools",
  "awards",
  "publications",
  "contact",
  "personal details",
];
export const HEADING_LINE = new RegExp(
  `^\\s*[·•\\-–—]?\\s*(?:${HEADINGS.map((h) => h.replace(/[&]/g, "(?:&|and)").replace(/\s+/g, "\\s+")).join("|")})\\s*:?\\s*$`,
  "i",
);
/** Section headings that describe the document, not a topic a requirement could ask about. */
const GENERIC_HEADING =
  /\b(?:professional|experience|employment|career|work|summary|profile|objectives?|about\s+me|personal|contact|references)\b/i;
/** Headings written in capitals inside a flattened page: "… PROFESSIONAL EXPERIENCE Regional …". */
const INLINE_HEADING =
  /\b(?:PROFESSIONAL (?:EXPERIENCE|SUMMARY|PROFILE|BACKGROUND|DEVELOPMENT)|WORK (?:EXPERIENCE|HISTORY)|EMPLOYMENT HISTORY|CAREER (?:SUMMARY|OBJECTIVE|HISTORY|PROFILE|HIGHLIGHTS)|CORE (?:SKILLS|COMPETENCIES)|TECHNICAL SKILLS|COMPUTER SKILLS)\b/g;

const CONTACT_LINE =
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\blinkedin\.com\b|\b(?:tel|phone|mobile|cell|e-?mail)\s*[:.]?\s*\+?[\d(]|(?:\+?\d[\d\s().-]{8,}\d)/i;
/** "245 Golf Avenue E", "13 Jade Meadow Drive, Springfield, NJ 07081". */
export const STREET_ADDRESS =
  /^\s*\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,4}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|place|pl|way|terrace|ter|circle|cir|highway|hwy|parkway|pkwy|square|sq|trail|trl|close|crescent|gardens?|grove|row|walk)\b\.?(?:\s+[NSEW]{1,2}\b)?/i;
const CITY_STATE_ZIP = /^\s*[A-Za-z .'-]{2,40},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$/;

/** A statement of what the person wants, not of what they have done. */
const OBJECTIVE_SENTENCE =
  /\b(?:to\s+(?:obtain|secure|gain|find|pursue)|seeking|looking\s+for|in\s+search\s+of|i\s+wish\s+to|i\s+am\s+(?:seeking|looking))\b[^.!?\n]{0,220}\b(?:position|role|opportunity|career|job|employment|organi[sz]ation|company|team|association)\b[^.!?\n]*[.!?]?/gi;

/** Clubs, employee groups, hobbies: the line is about belonging, not about the work. */
const CLUB_LINE =
  /\b(?:employee\s+(?:engagement|resource)\s+(?:groups?|committees?|teams?)|\bERGs?\b|social\s+committee|member\s+of\s+(?:several\s+|the\s+|an?\s+)?[\w&' -]{0,40}\b(?:clubs?|societ(?:y|ies)|fraternit(?:y|ies)|sororit(?:y|ies))\b|\b(?:hobbies|interests)\s*:)/i;

function blank(chars: string[], from: number, to: number): void {
  for (let i = Math.max(0, from); i < Math.min(chars.length, to); i++) {
    if (chars[i] !== "\n") chars[i] = " ";
  }
}

export function maskNonQuotableLines(text: string): string {
  if (!text) return text;
  // UTF-16 units, so offsets stay those of the text.
  const out = text.split("");

  // 1. Line by line: headings, contact lines, street addresses.
  let pos = 0;
  let lineNo = 0;
  let objectiveUntil = -1;
  const rawLines = text.split("\n");
  for (const raw of rawLines) {
    const start = pos;
    const end = pos + raw.length;
    pos = end + 1;
    lineNo += 1;
    // Only the headings that name no topic: "PROFESSIONAL EXPERIENCE",
    // "Summary", "Objective". "Languages" above "Arabic: native" and
    // "Education" above a degree say what the lines under them are, and a
    // requirement about languages or education may read them.
    const isHeading = raw.length <= 60 && HEADING_LINE.test(raw) && GENERIC_HEADING.test(raw);
    if (isHeading) {
      blank(out, start, end);
      // An objective section runs to the next heading (or a few lines).
      objectiveUntil = /\bobjectives?\b/i.test(raw) ? lineNo + 5 : -1;
      continue;
    }
    if (objectiveUntil >= lineNo) {
      blank(out, start, end);
      continue;
    }
    if (raw.length <= 160 && (STREET_ADDRESS.test(raw) || CITY_STATE_ZIP.test(raw))) {
      blank(out, start, end);
      continue;
    }
    // Contact details sit in short lines; a long line that happens to hold a
    // phone number is not a contact line.
    if (raw.length <= 160 && CONTACT_LINE.test(raw) && raw.split(/\s+/).length <= 16) {
      blank(out, start, end);
      continue;
    }
    if (CLUB_LINE.test(raw)) {
      // The bullet the mention sits in: back to the bullet mark or sentence
      // start on this line, forward to the end of the sentence, which may
      // wrap onto the next line.
      const at = raw.search(CLUB_LINE);
      const before = raw.slice(0, at);
      const from = Math.max(before.lastIndexOf("•"), before.lastIndexOf(". "), -1) + 1;
      const rest = text.slice(start + at, Math.min(text.length, start + at + 320));
      const stop = rest.search(/[.!?](?:\s|$)|\n\s*[^A-Za-z0-9("'\s]/);
      blank(out, start + from, start + at + (stop < 0 ? rest.length : stop + 1));
    }
  }

  let masked = out.join("");
  // 2. Capital headings inside a flattened page.
  masked = masked.replace(INLINE_HEADING, (m) => " ".repeat(m.length));
  // 3. Objective sentences anywhere in the first part of the CV.
  const head = masked.slice(0, 1500).replace(OBJECTIVE_SENTENCE, (m) => m.replace(/[^\n]/g, " "));
  masked = head + masked.slice(1500);
  return masked;
}
