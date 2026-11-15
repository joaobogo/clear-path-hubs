/**
 * What a years requirement is about (v1.7.7).
 *
 * "5+ years of billing experience" asks for five years of billing, not five
 * years of work. Before this, every dated role on the CV counted, so a senior
 * accountant with one billing job read as 28.8 years of billing and of team
 * management. The subject decides which roles count: a role counts when its
 * own lines show the subject.
 *
 * Two kinds of subject:
 *  - team: "2+ years managing a team", "3 years of people management".
 *    Strong evidence is a line describing people managed; a manager title
 *    alone is weak.
 *  - terms: the requirement's own content words ("billing"), with the
 *    synonym table. A role counts when the words appear in the role.
 *
 * A requirement with no subject of its own ("10+ years of experience") keeps
 * counting every role. Marketing keeps its title rule in structured-requirements.
 */
import { expandTerm } from "./term-synonyms";

export type YearsSubject =
  | { kind: "team"; label: string; strong: RegExp; weak: RegExp }
  | { kind: "terms"; label: string; strong: RegExp; weak: RegExp };

/** "managing a team", "people management", "supervisory experience". */
const TEAM_REQUIREMENT =
  /\b(manag\w*|supervis\w*|lead|leads|leading|led|direct\w*|oversee\w*|running)\b[^.;:]{0,40}\b(teams?|people|staff|direct\s+reports?|employees|reports)\b|\b(people|team|staff|line)\s+(management|leadership|supervision|manager)\b|\bsupervisory\b/i;

/** People a manager manages, as a CV names them. */
const TEAM_NOUN = String.raw`(?:teams?|staff|employees|direct\s+reports?|assistants|coordinators|collectors|analysts|specialists|associates|clerks|agents|representatives|interns|supervisors|accountants|billers|team\s+members|people)`;

/**
 * A line that describes people managed: a team, a headcount, direct reports.
 * The people must be what the verb manages: at most four words between
 * ("managing three employees", "supervised 14 staff"). "Managed a large
 * portfolio of accounts for the Public Sector teams" is not a team managed.
 */
const TEAM_STRONG = new RegExp(
  [
    String.raw`\b(?:manag\w*|supervis\w*|led|lead|leads|leading|oversaw|oversee\w*|direct(?:ed|ing|s)?|mentor\w*|coach\w*|train(?:ed|ing|s)?|recruit\w*|hir(?:ed|ing)|develop(?:ed|ing|s)?)(?:[\s,/&-]+[\w'+]+){0,4}[\s,/&-]+${TEAM_NOUN}\b`,
    // a team / staff / department of 7
    String.raw`\b(?:team|staff|department|group|crew|unit)\s+of\s+(?:up\s+to\s+|over\s+|about\s+|approximately\s+)?(?:\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b`,
    // 14 staff, 58 employees, 3 direct reports, a 20+ person team
    String.raw`\b\d+\s*\+?\s*(?:[-\s]person\s+team|staff|employees|direct\s+reports?|team\s+members|reports|ftes?)\b`,
    String.raw`\bdirect\s+reports?\b`,
  ].join("|"),
  "i",
);

/** A title that suggests managing people, with no team described. */
const TEAM_WEAK =
  /\b(manager|supervisor|director|head\s+of|team\s+lead(?:er)?|lead|chief|vice\s+president|vp|avp|foreman|superintendent|controller)\b/i;

/** Words of a years requirement that are not its subject. */
const NOT_SUBJECT = new Set([
  "years",
  "year",
  "yrs",
  "least",
  "minimum",
  "min",
  "more",
  "plus",
  "over",
  "total",
  "overall",
  "experience",
  "experienced",
  "experiences",
  "progressive",
  "relevant",
  "related",
  "proven",
  "professional",
  "working",
  "work",
  "worked",
  "role",
  "roles",
  "position",
  "positions",
  "capacity",
  "similar",
  "equivalent",
  "comparable",
  "field",
  "industry",
  "environment",
  "setting",
  "level",
  "senior",
  "leadership",
  "management",
  "managerial",
  "lead",
  "leading",
  "head",
  "executive",
  "full-time",
  "post-qualification",
  "hands-on",
  "practical",
  "solid",
  "strong",
  "demonstrated",
  "has",
  "have",
  "been",
  "having",
  "with",
  "within",
  "the",
  "for",
  "and",
  "or",
  "of",
  "in",
  "at",
  "as",
  "an",
  "a",
  "to",
  "on",
  "is",
  "are",
  "be",
  "not",
  "must",
  "should",
  "ideally",
  "preferably",
  // Generic title nouns: "5 years as a billing manager" is about billing.
  "manager",
  "specialist",
  "analyst",
  "officer",
  "assistant",
  "coordinator",
  "associate",
  "supervisor",
  "director",
  "administrator",
  "executive",
  "consultant",
  "professional",
]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Plural and -ing/-ed forms a role line may use for a subject word. */
function subjectForms(term: string): string[] {
  const out = new Set<string>([term]);
  if (/^[a-z]{4,}$/.test(term)) {
    out.add(`${term}s`);
    if (term.endsWith("ing")) {
      const stem = term.slice(0, -3);
      // billing -> billed, biller, bills (the noun "bill" is too broad to add)
      out.add(`${stem}ed`);
      out.add(`${stem}er`);
      out.add(`${stem}ers`);
    }
  }
  return [...out];
}

/** Subject synonyms that are specific to counting years (wider than the term table). */
const SUBJECT_SYNONYMS: Record<string, string[]> = {
  // Issuing invoices is billing; "processing vendor invoices" is accounts payable.
  billing: [
    "invoicing",
    "revenue cycle",
    "e-billing",
    "pre-bill",
    "pre-bills",
    "medical biller",
    "bill review",
    "issued invoices",
    "issuing invoices",
    "issue invoices",
    "prepared invoices",
    "preparing invoices",
    "generated invoices",
    "generating invoices",
    "invoice preparation",
    "invoice generation",
    "client invoices",
    "customer invoices",
  ],
  invoicing: ["billing"],
  payroll: ["payroll"],
  bookkeeping: ["bookkeeper", "full charge"],
  accounting: ["accountant", "bookkeeping", "month-end close", "general ledger"],
  collections: ["collector", "collectors", "accounts receivable", "a/r"],
  sales: ["account executive", "business development"],
  recruitment: ["recruiter", "recruiting", "talent acquisition"],
  recruiting: ["recruiter", "recruitment", "talent acquisition"],
};

/**
 * The subject of a years requirement, or null when it names none ("5+ years
 * of experience") or is the marketing shape handled by its own title rule.
 */
export function parseYearsSubject(text: string): YearsSubject | null {
  if (TEAM_REQUIREMENT.test(text)) {
    return { kind: "team", label: "managing a team", strong: TEAM_STRONG, weak: TEAM_WEAK };
  }
  if (/\bmarketing\b/i.test(text)) return null;
  // The words the years attach to: "years of <billing> experience",
  // "years' experience in <mushroom harvesting>", "years as a <billing> manager".
  const phrase =
    text.match(
      /\byears?['’]?\s+(?:of\s+|in\s+|as\s+(?:an?\s+)?)?(?!experience\b)(.{2,60}?)\s+(?:experience|background)\b/i,
    )?.[1] ??
    text.match(
      /\b(?:experience|background)\s+(?:in|with|of|as)\s+(?:an?\s+|the\s+)?(.{2,60})/i,
    )?.[1] ??
    text.match(/\byears?['’]?\s+(?:in|as|of)\s+(?:an?\s+|the\s+)?(.{2,60})/i)?.[1] ??
    text;
  const words = (phrase.toLowerCase().match(/[a-z][a-z/&-]{2,}/g) ?? []).filter(
    (w) => !NOT_SUBJECT.has(w) && !/^\d/.test(w),
  );
  const terms = [...new Set(words)].slice(0, 2);
  if (terms.length === 0) return null;
  const forms = new Set<string>();
  for (const t of terms) {
    for (const base of [...expandTerm(t), ...(SUBJECT_SYNONYMS[t] ?? [])]) {
      for (const f of subjectForms(base)) forms.add(f);
    }
  }
  const alt = [...forms]
    .sort((a, b) => b.length - a.length)
    .map((f) => escapeRe(f).replace(/\s+/g, "\\s+"))
    .join("|");
  const re = new RegExp(`(?<![A-Za-z0-9])(?:${alt})(?![A-Za-z0-9])`, "i");
  return { kind: "terms", label: terms.join(" "), strong: re, weak: re };
}
