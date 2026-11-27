/**
 * Wording equivalence (v1.8.0): the same fact said in different words scores
 * the same.
 *
 * A requirement is written by one person ("total contract value", "new-logo
 * sales (hunting)", "bookings targets") and a CV by another ("ACV on a
 * multi-year agreement", "net-new customers", "quota"). The keyword matcher
 * reads words, so the wording decided the score. This layer says which
 * wordings are one thing.
 *
 * The table is data: src/lib/scoring/wording-equivalence.json. A recruiter's
 * term is added there, with no change to this file or the engine. It is
 * versioned with the engine, so the same CV always scores the same under one
 * engine version.
 *
 * Two rules the table must keep:
 *  1. Wording only. An entry never lists adjacent experience as the thing
 *     itself: cloud migration selling is not Snowflake or Databricks
 *     experience. That stays a recruiter's call (a Partial verdict).
 *  2. Context decides. An entry applies to a requirement keyword only when
 *     the requirement itself uses one of the entry's phrases, so "value" in
 *     "total contract value" may be evidenced by "ACV", and "value" in "adds
 *     value to the team" may not.
 *
 * term-synonyms.ts is the context-free table (one word, always the same
 * aliases). This one is for phrases whose meaning depends on the requirement.
 */
import raw from "./wording-equivalence.json";

export type EquivalenceConcept = {
  id: string;
  note?: string;
  /** How a role may ask for it. A concept applies when one of these is in the requirement. */
  requirement_says: string[];
  /** How a CV, profile or answer may say it. */
  also_match: string[];
  /**
   * Words of a title that mean nothing on their own ("head" in "Head of
   * Data"). In a requirement that uses the title they are evidenced only by
   * the entry's wordings, never by the bare word elsewhere in the CV.
   */
  strict_words: string[];
  /**
   * When set, the entry applies only to a requirement that also uses one of
   * these words: "CIO" and "CTO" are interchangeable as buyers of
   * technology, not in "reports to the CTO".
   */
  only_when_requirement_mentions: string[];
};

export type CommutablePlace = {
  place: string;
  note?: string;
  /** The place as a requirement names it. */
  requirement_says: string[];
  /** Home locations that are the place or within commuting distance of it. */
  home_is: string[];
  /** Words that say which country the home is in. */
  needs_context: string[];
  /** Homes that need no country beside them. */
  alone_is_enough: string[];
};

type Table = { version: string; concepts: EquivalenceConcept[]; commutable: CommutablePlace[] };

const lower = (xs: unknown): string[] =>
  Array.isArray(xs)
    ? xs.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim().toLowerCase())
    : [];

function load(): Table {
  const t = raw as { version?: unknown; concepts?: unknown; commutable?: unknown };
  const concepts = (Array.isArray(t.concepts) ? t.concepts : []).map((c) => {
    const o = c as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      note: typeof o.note === "string" ? o.note : undefined,
      requirement_says: lower(o.requirement_says),
      also_match: lower(o.also_match),
      strict_words: lower(o.strict_words),
      only_when_requirement_mentions: lower(o.only_when_requirement_mentions),
    };
  });
  const commutable = (Array.isArray(t.commutable) ? t.commutable : []).map((c) => {
    const o = c as Record<string, unknown>;
    return {
      place: String(o.place ?? ""),
      note: typeof o.note === "string" ? o.note : undefined,
      requirement_says: lower(o.requirement_says),
      home_is: lower(o.home_is),
      needs_context: lower(o.needs_context),
      alone_is_enough: lower(o.alone_is_enough),
    };
  });
  return { version: String(t.version ?? ""), concepts, commutable };
}

const TABLE = load();

/** The data file's own version, recorded for review; the engine version is what a run stores. */
export const WORDING_EQUIVALENCE_VERSION = TABLE.version;
/** Exposed for tests and review, so drift in the table is visible. */
export const EQUIVALENCE_CONCEPTS: readonly EquivalenceConcept[] = TABLE.concepts;
export const COMMUTABLE_PLACES: readonly CommutablePlace[] = TABLE.commutable;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A phrase as whole words, any run of spaces or a line break between them. */
function phraseRe(phrase: string, flags = "i"): RegExp {
  return new RegExp(
    `(^|[^a-z0-9])${escapeRe(phrase).replace(/\s+/g, "\\s+")}([^a-z0-9]|$)`,
    flags,
  );
}

/** The words of a phrase as the engine's tokenizer cuts them. */
function wordsOf(phrase: string): string[] {
  return phrase.toLowerCase().match(/[a-z0-9+.#-]{2,}/g) ?? [];
}

type Applied = { concept: EquivalenceConcept; covered: Set<string> };

const appliedCache = new Map<string, Applied[]>();

/**
 * The concepts a requirement uses, each with the requirement's own words it
 * stands for: "total contract value" in the requirement covers "total",
 * "contract" and "value".
 */
function conceptsIn(requirementText: string): Applied[] {
  const key = requirementText;
  const hit = appliedCache.get(key);
  if (hit) return hit;
  const text = requirementText.toLowerCase();
  const out: Applied[] = [];
  for (const concept of TABLE.concepts) {
    if (
      concept.only_when_requirement_mentions.length > 0 &&
      !concept.only_when_requirement_mentions.some((w) => phraseRe(w).test(text))
    )
      continue;
    const covered = new Set<string>();
    for (const phrase of concept.requirement_says) {
      if (!phraseRe(phrase).test(text)) continue;
      for (const w of wordsOf(phrase)) covered.add(w);
    }
    if (covered.size > 0) out.push({ concept, covered });
  }
  if (appliedCache.size > 500) appliedCache.clear();
  appliedCache.set(key, out);
  return out;
}

/**
 * Other wordings that are evidence for one keyword of a requirement. Empty
 * unless the requirement uses a phrase from the table that contains the
 * keyword. The keyword itself is not repeated.
 */
export function equivalentForms(requirementText: string, keyword: string): string[] {
  const k = keyword.trim().toLowerCase();
  if (!k) return [];
  const out: string[] = [];
  for (const { concept, covered } of conceptsIn(requirementText)) {
    if (!covered.has(k)) continue;
    for (const form of concept.also_match) {
      if (form !== k && !out.includes(form)) out.push(form);
    }
  }
  return out;
}

/**
 * True when the keyword is part of a wording the table knows in this
 * requirement. Such a word is a way of saying something ("Head of Data" for a
 * senior buyer), not the name of a product the CV must repeat.
 */
export function isEquivalenceWording(requirementText: string, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  return conceptsIn(requirementText).some(({ covered }) => covered.has(k));
}

/**
 * True when the keyword is a title word read only as the title in this
 * requirement: the bare word in the CV is not evidence for it.
 */
export function isTitleWordOnly(requirementText: string, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  return conceptsIn(requirementText).some(
    ({ concept, covered }) => covered.has(k) && concept.strict_words.includes(k),
  );
}

// ---------------------------------------------------------------------------
// Commutable places: "based in or commutable to London"
// ---------------------------------------------------------------------------

/** The commutable place a requirement names, or null. */
export function commutablePlaceIn(requirementText: string): CommutablePlace | null {
  const text = requirementText.toLowerCase();
  return (
    TABLE.commutable.find((p) => p.requirement_says.some((name) => phraseRe(name).test(text))) ??
    null
  );
}

/**
 * Where a home location puts someone for a commutable place: the part of the
 * text that names the place, a borough or a county in its belt, or null.
 *
 * A county or borough name is shared with towns elsewhere (Richmond,
 * Virginia; Kent, Washington; Essex County, New Jersey), so it counts only
 * with the country beside it. "UK", "UK & Ireland" or "EMEA" on their own
 * name no home at all and return null.
 */
export function homeWithinCommute(
  place: CommutablePlace,
  homeText: string | null | undefined,
): { matched: string } | null {
  const text = (homeText ?? "").toLowerCase();
  if (!text.trim()) return null;
  // A UK phone number beside the place says which country it is in.
  const hasContext =
    place.needs_context.some((c) => phraseRe(c).test(text)) || /(^|[^\d])\+44[\s\d(]/.test(text);
  // A location is written as fields: "Hertfordshire, UK • +44 …", "Sutton,
  // United Kingdom". The place must be a field of its own, so a first name
  // ("Kent Johnson") or a street ("Brent Cross") is never read as a home.
  const fields = text
    .split(/[|•·,;\n\t]|\s[-–—]\s/)
    .map((f) => f.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const context = place.needs_context.map(escapeRe).join("|");
  // Longest names first, so "Kingston upon Thames" is read before "Kingston".
  const homes = [...place.home_is].sort((a, b) => b.length - a.length);
  for (const home of homes) {
    const name = escapeRe(home).replace(/\s+/g, "\\s+");
    const asField = new RegExp(
      `^(?:(?:north|south|east|west|central|inner|outer|greater)\\s+|london\\s+borough\\s+of\\s+|royal\\s+borough\\s+of\\s+)?${name}(?:\\s+(?:area|region|borough))?(?:\\s+(?:${context}))?$`,
      "i",
    );
    if (!fields.some((f) => asField.test(f))) continue;
    if (!hasContext && !place.alone_is_enough.includes(home)) continue;
    return { matched: home };
  }
  return null;
}
