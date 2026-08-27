/**
 * A quoted passage is only evidence for a requirement when it actually talks
 * about that requirement. Runs sometimes attach a generic CV sentence to every
 * requirement (and, in seeded data, to every candidate), which produces the
 * same passage under unrelated requirements on different profiles.
 *
 * This guard is the single place that decides whether a passage supports a
 * requirement. Every surface that renders requirement evidence must filter
 * through it, so no surface can quote a passage another surface rejects.
 */

/** Words too generic to link a passage to a requirement. */
const GENERIC = new Set([
  "experience",
  "experienced",
  "working",
  "worked",
  "work",
  "team",
  "teams",
  "based",
  "strong",
  "solid",
  "proven",
  "practical",
  "hands",
  "ability",
  "able",
  "years",
  "year",
  "with",
  "within",
  "from",
  "through",
  "into",
  "using",
  "used",
  "role",
  "roles",
  "environment",
  "including",
  "such",
  "also",
  "well",
  "good",
  "very",
  "must",
  "have",
  "this",
  "that",
  "their",
  "them",
  "they",
  "and",
  "the",
  "for",
  "our",
  "any",
  "plus",
  "over",
  "across",
  "level",
  "senior",
  "junior",
  "company",
  "companies",
  "project",
  "projects",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\- ]+/g, " ")
    .split(/[\s.]+/)
    .map((t) => t.replace(/^[-+.]+|[-+.]+$/g, ""))
    .filter((t) => t.length >= 3 && !GENERIC.has(t));
}

/** Loose stem so "founder"/"founders" and "scale"/"scaling" still match. */
function stem(t: string): string {
  return t.replace(/(ing|ers|er|ies|ed|s)$/, "");
}

/**
 * Words that describe an attitude or an everyday verb rather than the subject
 * of a requirement. "Comfortable writing and maintaining automated tests"
 * shares "comfortable" and "writing" with "Comfortable being the most senior
 * engineer in the room and still writing the difficult parts myself" — a
 * passage about seniority, not tests. Sharing only these words is not support:
 * the passage has to speak to the requirement's own subject.
 */
const SOFT = new Set(
  [
    "comfortable",
    "confident",
    "happy",
    "willing",
    "keen",
    "eager",
    "interested",
    "write",
    "writing",
    "written",
    "maintain",
    "maintaining",
    "maintained",
    "build",
    "building",
    "built",
    "deliver",
    "delivering",
    "own",
    "owning",
    "ownership",
    "run",
    "running",
    "make",
    "making",
    "keep",
    "keeping",
    "take",
    "taking",
    "help",
    "helping",
    "support",
    "supporting",
    "need",
    "needs",
    "want",
    "part",
    "parts",
    "day",
    "week",
    "first",
    "still",
    "myself",
    "room",
    "difficult",
    "engineer",
    "engineers",
    "engineering",
    "developer",
    "developers",
    "software",
    "people",
    "person",
  ].map(stem),
);

function looseMatch(w: string, have: Set<string>): boolean {
  if (have.has(w)) return true;
  // Allow compound forms: "row-level" vs "rowlevel", "founder-led" vs "founderled".
  for (const h of have) {
    if (h.length >= 5 && (h.includes(w) || w.includes(h))) return true;
  }
  return false;
}

/**
 * True when the passage speaks to the requirement's subject — the minimum bar
 * for quoting it as direct evidence under a "Met" mark.
 */
export function passageSupportsRequirement(
  passage: string,
  requirementLabel: string,
): boolean {
  const wanted = new Set(tokens(requirementLabel).map(stem));
  if (wanted.size === 0) return true; // nothing specific to check against
  const have = new Set(tokens(passage).map(stem));

  // The requirement's subject terms. When it has any, the passage must hit one
  // of them; attitude words on their own never carry a quote.
  const subject = [...wanted].filter((w) => !SOFT.has(w));
  if (subject.length > 0) {
    return subject.some((w) => looseMatch(w, have));
  }

  for (const w of wanted) {
    if (have.has(w)) return true;
    for (const h of have) {
      if (h.length >= 5 && (h.includes(w) || w.includes(h))) return true;
    }
  }
  return false;
}
