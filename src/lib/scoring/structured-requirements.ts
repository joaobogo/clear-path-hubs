/**
 * Deterministic evaluators for requirement shapes keyword overlap gets wrong:
 * years thresholds, degrees, location/relocation, market experience.
 * Each returns null when the requirement isn't its shape, so the keyword
 * engine's verdict stands.
 */
import { yearsFromEmploymentDates } from "@/lib/cv/employment-dates";
import { countriesIn, evaluateMarketExperience, isMarketExperienceRequirement, termsFor } from "./geography";

export type StructuredStatus = "met" | "partial" | "missing";
export type StructuredVerdict = {
  kind: "years" | "leadership_years" | "degree" | "location" | "market";
  status: StructuredStatus;
  snippet: string;
  needs_validation?: boolean;
};

export type StructuredScreening = {
  question: string;
  answer_type: string;
  value: unknown;
};

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};
const LEADERSHIP = /\b(?:leadership|leading|managerial|management|manag(?:er|ing)|head of|director|lead(?:ing)? teams?|senior leadership|people management)\b/i;

/** Required years from a requirement, e.g. "10 or more years", "10+ years", "minimum of 8 years". */
export function requiredYears(text: string): { years: number; leadership: boolean } | null {
  const m = text.match(
    /\b(?:at least|minimum(?: of)?|min\.?|over|more than)?\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\s*(?:\+|\s*or more|\s*plus)?\s*(?:-|–)?\s*years?\b/i,
  );
  if (!m) return null;
  const n = Number(m[1]) || NUM_WORDS[m[1].toLowerCase()];
  if (!n) return null;
  // Is the leadership word attached to this requirement?
  return { years: n, leadership: LEADERSHIP.test(text) };
}

/**
 * Explicit duration claims in a CV: "25+ years", "16+ years in leadership",
 * "over 12 years of experience". Ignores numbers that aren't durations
 * ("a 10-year gap", "10-year anniversary", "top 10", "10 stores").
 */
export function claimedYears(cv: string): { total: number; leadership: number; totalSnippet: string; leadershipSnippet: string } {
  let total = 0;
  let leadership = 0;
  let totalSnippet = "";
  let leadershipSnippet = "";
  const re = /(?:over|more than|nearly|almost|about|around)?\s*(\d{1,2})\s*(\+|\s*plus)?\s*years?\b(?!-)([^.\n]{0,60})/gi;
  for (const m of cv.matchAll(re)) {
    const n = Number(m[1]);
    const before = cv.slice(Math.max(0, (m.index ?? 0) - 25), m.index ?? 0);
    const tail = m[3] ?? "";
    // "a 10-year gap" / "10-year contract": hyphenated adjective forms are not durations of experience.
    if (/-\s*$/.test(before) || /^\s*-/.test(tail)) continue;
    if (/\b(?:gap|break|anniversary|old|contract|plan|warranty|lease|ago)\b/i.test(tail.slice(0, 20))) continue;
    if (!/\b(?:experience|career|in|of|across|leading|managing|marketing|industry|working|leadership)\b/i.test(tail)) continue;
    if (n < 1 || n > 50) continue;
    const sentence = `${m[0]}`.trim();
    if (LEADERSHIP.test(tail) || /\b(?:leadership|leader)\b/i.test(before)) {
      if (n > leadership) {
        leadership = n;
        leadershipSnippet = sentence;
      }
    }
    if (n > total) {
      total = n;
      totalSnippet = sentence;
    }
  }
  return { total, leadership, totalSnippet, leadershipSnippet };
}

function yearsVerdict(need: number, have: number): StructuredStatus {
  if (have >= need) return "met";
  if (have >= need * 0.7) return "partial";
  return "missing";
}

const DEGREE_REQ = /\b(?:bachelor'?s?|degree|undergraduate|university education|BA|BSc|BCom|BBA|B\.?A\.?|B\.?Sc\.?)\b/;
const DEGREE_CV = /\b(?:bachelor(?:'?s)?(?: of| degree| in)?|B\.?A\.?(?:\s|\(|,|$)|B\.?Sc\.?|B\.?Com\.?|BBA|B\.?Eng\.?|B\.?Tech|LLB|BFA|honou?rs degree|undergraduate degree|licenciatura|master(?:'?s)?(?: of| degree| in)?|M\.?Sc\.?|MBA|M\.?A\.?(?:\s|\()|PhD|doctorate)\b/;

function screeningYes(screening: StructuredScreening[], re: RegExp): StructuredScreening | null {
  return (
    screening.find((s) => {
      if (s.answer_type !== "boolean") return false;
      const v = s.value && typeof s.value === "object" && "value" in (s.value as object) ? (s.value as { value: unknown }).value : s.value;
      return (v === true || v === "yes" || v === "true") && re.test(s.question);
    }) ?? null
  );
}

export function evaluateStructuredRequirement(input: {
  text: string;
  cv: string;
  screening: StructuredScreening[];
  candidateLocation?: string | null;
  asOf?: Date;
}): StructuredVerdict | null {
  const { text, cv, screening } = input;

  // Location / relocation — "Based in Dubai or willing to relocate".
  if (/\b(?:based in|located in|reside|relocat|on-?site in|live in)\b/i.test(text)) {
    const places = countriesIn(text);
    const loc = `${input.candidateLocation ?? ""}`;
    const header = cv.slice(0, 600);
    if (places.length) {
      const here = places.some((c) => termsFor(c).some((t) => new RegExp(`(?<![A-Za-z])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`, "i").test(`${loc}\n${header}`)));
      if (here) return { kind: "location", status: "met", snippet: `Located in ${loc || "the listed location"}` };
    }
    if (/relocat/i.test(text)) {
      const yes = screeningYes(screening, /relocat|move to|based in|work in/i);
      if (yes) return { kind: "location", status: "met", snippet: `Answered yes to: "${yes.question}"` };
    }
    return null;
  }

  // Degree
  if (DEGREE_REQ.test(text) && !/\b(?:master|mba|phd)\b/i.test(text)) {
    const m = cv.match(DEGREE_CV);
    if (m) {
      const idx = m.index ?? 0;
      return { kind: "degree", status: "met", snippet: cv.slice(Math.max(0, idx - 20), idx + 100).trim() };
    }
    return null;
  }

  // Market experience
  if (isMarketExperienceRequirement(text)) {
    const g = evaluateMarketExperience(text, cv);
    if (g.status === "missing") return null;
    return { kind: "market", status: g.status, snippet: g.snippet ?? "", needs_validation: g.status === "partial" };
  }

  // Years thresholds
  const need = requiredYears(text);
  if (need) {
    const claims = claimedYears(cv);
    if (need.leadership) {
      const have = claims.leadership;
      if (!have) return null;
      return { kind: "leadership_years", status: yearsVerdict(need.years, have), snippet: claims.leadershipSnippet };
    }
    let have = claims.total;
    let snippet = claims.totalSnippet;
    try {
      const dated = yearsFromEmploymentDates(cv, input.asOf ?? new Date());
      if (dated && dated > have) {
        have = Math.floor(dated);
        snippet = `${have} years from dated roles`;
      }
    } catch {
      /* dated parser is best-effort */
    }
    if (!have) return null;
    return { kind: "years", status: yearsVerdict(need.years, have), snippet };
  }
  return null;
}
