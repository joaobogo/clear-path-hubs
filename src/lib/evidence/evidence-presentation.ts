/**
 * Presentation-only hygiene for client-facing evidence items.
 *
 * Stored evidence is untouched: everything here happens at render time.
 *
 * Three jobs:
 *  1. Drop CV section headings (whole or sliced mid-word) from the start of a
 *     quote, and refuse to render what is left when it is not a readable
 *     sentence.
 *  2. Collapse identical and near-identical snippets so one requirement never
 *     shows the same sentence twice, and never repeats the summary line above.
 *  3. Name where a quote came from — section, dates, employer, position —
 *     instead of only "Curriculum Vitae".
 */

import { humanizeSource, renderQuote } from "@/lib/evidence/quote-hygiene";

export type RawEvidenceItem = {
  label?: string;
  snippet: string;
  source?: string | null;
  location?: import("@/lib/client-fit-presentation").EvidenceLocation;
};

export type PresentedEvidenceItem = {
  /** Cleaned quote, guaranteed readable. Empty means: render no quote. */
  quote: string;
  /** Human source line, e.g. "Curriculum Vitae · Employment history · 2019–2022". */
  sourceLine: string;
  /** Section of the document the quote sits in, when recognisable. */
  section: string | null;
};

/** CV section headings, longest first so "employment history" wins over "history". */
const SECTION_HEADINGS = [
  "employment history",
  "professional experience",
  "work experience",
  "work history",
  "selected projects",
  "career history",
  "core competencies",
  "technical skills",
  "certifications",
  "achievements",
  "publications",
  "experience",
  "education",
  "languages",
  "references",
  "projects",
  "profile",
  "summary",
  "history",
  "skills",
  "awards",
  "courses",
  "contact",
] as const;

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Strip a leading section heading, including a heading sliced mid-word by a
 * character-offset extract ("TORY " from HISTORY, "NGUAGES " from LANGUAGES).
 */
export function stripSectionHeading(raw: string): { text: string; section: string | null } {
  let text = String(raw ?? "").replace(/\s+/g, " ").trim();
  let section: string | null = null;

  // Up to two passes: "SUMMARY PROFILE Eight years…" happens.
  for (let pass = 0; pass < 2; pass++) {
    let matched = false;
    for (const heading of SECTION_HEADINGS) {
      // Any suffix of the heading, 3 chars or longer, counts as slice debris.
      for (let start = 0; start <= heading.length - 3; start++) {
        const fragment = heading.slice(start);
        const re = new RegExp(`^${fragment}\\b[\\s:·\\-–—|]*`, "i");
        if (!re.test(text)) continue;
        // Only treat it as a heading when the source wrote it as a heading
        // (all caps, or followed by a separator) — never mid-sentence prose.
        const literal = text.slice(0, fragment.length);
        const isCaps = literal === literal.toUpperCase();
        const followedBySeparator = /^[a-z ]{0,40}[:·|]/i.test(text.slice(0, fragment.length + 2));
        if (!isCaps && !followedBySeparator) continue;
        text = text.replace(re, "").trim();
        section = section ?? titleCase(heading);
        matched = true;
        break;
      }
      if (matched) break;
    }
    if (!matched) break;
  }

  return { text, section };
}

/** A quote a client can read: a real sentence, not a label or a fragment. */
function isReadableQuote(text: string): boolean {
  const stripped = text.replace(/^…/, "").trim();
  if (stripped.length < 30) return false;
  const words = stripped.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length < 5) return false;
  // All-caps leftovers are headings, not prose.
  if (stripped === stripped.toUpperCase()) return false;
  // Must start on a word, not on debris.
  if (!/^[A-Za-z0-9]/.test(stripped)) return false;
  return true;
}

const DATE_RANGE_RE =
  /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(19|20)\d{2}\s*[–—-]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?((19|20)\d{2}|present|current)\b/i;
const SINGLE_DATE_RE =
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(19|20)\d{2}\b/i;

/** A date or date range named inside the document extract, when present. */
function extractDate(raw: string): string | null {
  const range = raw.match(DATE_RANGE_RE)?.[0];
  if (range) return range.replace(/\s*[–—-]\s*/, "–").replace(/\s+/g, " ").trim();
  const single = raw.match(SINGLE_DATE_RE)?.[0];
  return single ? single.replace(/\s+/g, " ").trim() : null;
}

/**
 * "Senior Software Engineer — Northwind" / "Senior Software Engineer at
 * Northwind": the position and employer the extract sits under.
 */
function extractRoleAndEmployer(raw: string): { position: string | null; employer: string | null } {
  const m = raw.match(
    /\b((?:Senior |Lead |Principal |Staff |Junior |Head of |Chief )?[A-Z][A-Za-z]+(?: [A-Z&][A-Za-z-]+){0,3}(?:Engineer|Developer|Designer|Manager|Analyst|Specialist|Architect|Consultant|Director|Lead|Officer))\s*(?:—|–|-|,|\bat\b|@)\s*([A-Z][A-Za-z0-9&.']*(?: [A-Z][A-Za-z0-9&.']*){0,2})/,
  );
  if (!m) return { position: null, employer: null };
  return { position: m[1].trim(), employer: m[2].trim() };
}

/** "cv:134-299" and friends carry no client meaning — a section name does. */
function baseSourceLabel(source: string | null | undefined): string {
  const human = humanizeSource(source);
  return human.startsWith("CV · characters") ? "Curriculum Vitae" : human;
}

/** Build the one-line provenance: base source plus whatever the record holds. */
export function buildSourceLine(item: RawEvidenceItem, section: string | null): string {
  const raw = String(item.snippet ?? "");
  const parts: string[] = [baseSourceLabel(item.source)];
  const loc = item.location;
  const locSection =
    loc && typeof loc === "object" && !Array.isArray(loc)
      ? ((loc as Record<string, unknown>).section ??
        (loc as Record<string, unknown>).heading ??
        null)
      : null;
  const sectionName = section ?? (typeof locSection === "string" ? titleCase(locSection) : null);
  if (sectionName) parts.push(sectionName);

  const { position, employer } = extractRoleAndEmployer(raw);
  if (employer) parts.push(employer);
  else if (position) parts.push(position);

  const date = extractDate(raw);
  if (date) parts.push(date);

  const page =
    loc && typeof loc === "object" && !Array.isArray(loc)
      ? ((loc as Record<string, unknown>).page ?? (loc as Record<string, unknown>).page_number)
      : null;
  if (page != null && String(page).trim()) parts.push(`page ${String(page).trim()}`);

  return parts.slice(0, 4).join(" · ");
}

/** Clean one evidence item for display. An empty `quote` means: show no quote. */
export function presentEvidenceItem(item: RawEvidenceItem): PresentedEvidenceItem {
  const { text, section } = stripSectionHeading(String(item.snippet ?? ""));
  const rendered = renderQuote(text);
  const quote = isReadableQuote(rendered) ? rendered : "";
  return { quote, sourceLine: buildSourceLine(item, section), section };
}

/** Comparison key: wording only, so punctuation and case can't hide a repeat. */
export function normaliseForCompare(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Two snippets say the same thing: one contains the other, or they mostly overlap. */
export function isNearDuplicate(a: string, b: string): boolean {
  const x = normaliseForCompare(a);
  const y = normaliseForCompare(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (long.includes(short)) return true;
  const shortWords = new Set(short.split(" "));
  const longWords = new Set(long.split(" "));
  let shared = 0;
  for (const w of shortWords) if (longWords.has(w)) shared++;
  return shared / shortWords.size >= 0.85;
}

/**
 * Present every evidence item, drop the unreadable ones, and collapse
 * duplicates — keeping the fullest wording of each distinct quote.
 *
 * `alsoShown` holds text rendered above the list (a summary line): a snippet
 * that repeats it is dropped rather than said twice.
 */
export function presentEvidenceList(
  items: RawEvidenceItem[],
  alsoShown: Array<string | null | undefined> = [],
): PresentedEvidenceItem[] {
  const seen: string[] = alsoShown
    .filter((t): t is string => !!t && t.trim().length > 0)
    .map((t) => t);
  const out: PresentedEvidenceItem[] = [];

  for (const item of items ?? []) {
    const presented = presentEvidenceItem(item);
    if (!presented.quote) continue;
    const dupIndex = out.findIndex((o) => isNearDuplicate(o.quote, presented.quote));
    if (dupIndex !== -1) {
      // Keep the fuller wording, and the richer source line with it.
      if (presented.quote.length > out[dupIndex].quote.length) out[dupIndex] = presented;
      continue;
    }
    if (seen.some((s) => isNearDuplicate(s, presented.quote))) continue;
    out.push(presented);
    seen.push(presented.quote);
  }

  return out;
}
