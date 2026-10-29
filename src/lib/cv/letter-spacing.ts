/**
 * Undo letter-spaced PDF text.
 *
 * Some designed CVs set every heading and date in spaced capitals, and the PDF
 * reader returns them a character at a time: "A U G 2 0 2 2 - A U G 2 0 2 3
 * D I R E C T O R O F M A R K E T I N G". Word boundaries are gone, so no rule
 * can read a date or a title out of it. This rebuilds what can be rebuilt
 * exactly (dates, ranges, "present") and splits the common title words, and
 * leaves everything else as it was. Text without long letter-spaced runs is
 * returned unchanged.
 */

/** Six or more single characters separated by single spaces. */
const SPACED_RUN = /(?<=^|\s)(?:\S ){5,}\S(?=\s|$)/g;

const MONTH = "JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC";
/** Title and section words worth separating so title rules can read them. */
const WORDS = [
  "PRESENT",
  "CURRENT",
  "SENIOR",
  "ASSISTANT",
  "ASSOCIATE",
  "EXECUTIVE",
  "CLUSTER",
  "REGIONAL",
  "GROUP",
  "CORPORATE",
  "GLOBAL",
  "DIRECTOR",
  "MANAGER",
  "HEAD",
  "CHIEF",
  "OFFICER",
  "LEAD",
  "VICE",
  "PRESIDENT",
  "MARKETING",
  "COMMUNICATIONS",
  "BRAND",
  "DIGITAL",
  "SALES",
  "PUBLIC",
  "RELATIONS",
  "ADMINISTRATOR",
  "COORDINATOR",
  "SPECIALIST",
  "EXPERIENCE",
  "EDUCATION",
  "PROFESSIONAL",
  "EMPLOYMENT",
  "HISTORY",
  "SKILLS",
  "LANGUAGES",
  "OF",
  "AND",
];
// Longest first, so ASSISTANT is not read as an "AS" + "SISTANT".
const WORD_RE = new RegExp(`(${[...WORDS].sort((a, b) => b.length - a.length).join("|")})`, "g");

function rebuild(run: string): string {
  let t = run.replace(/ /g, "");
  // Dates: AUG2022 -> AUG 2022; ranges keep a spaced hyphen.
  t = t.replace(new RegExp(`(${MONTH})((?:19|20)\\d{2})`, "g"), " $1 $2 ");
  t = t.replace(/\s*-\s*/g, " - ");
  // A start date followed directly by PRESENT is an open range.
  t = t.replace(/((?:19|20)\d{2})\s+(PRESENT|CURRENT)/g, "$1 - $2");
  // Split the remaining capitals into known words where they occur.
  t = t.replace(/[A-Z]{6,}/g, (block) => block.replace(WORD_RE, " $1 "));
  return ` ${t.replace(/\s{2,}/g, " ").trim()} `;
}

export function normaliseLetterSpacing(text: string): string {
  if (!text || !SPACED_RUN.test(text)) return text;
  SPACED_RUN.lastIndex = 0;
  return text.replace(SPACED_RUN, (run) => rebuild(run)).replace(/ {2,}/g, " ");
}
