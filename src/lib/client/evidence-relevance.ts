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
 * True when the passage shares at least one meaningful term with the
 * requirement — the minimum bar for quoting it as direct evidence.
 */
export function passageSupportsRequirement(
  passage: string,
  requirementLabel: string,
): boolean {
  const wanted = new Set(tokens(requirementLabel).map(stem));
  if (wanted.size === 0) return true; // nothing specific to check against
  const have = new Set(tokens(passage).map(stem));
  for (const w of wanted) {
    if (have.has(w)) return true;
    // Allow compound forms: "row-level" vs "rowlevel", "founder-led" vs "founderled".
    for (const h of have) {
      if (h.length >= 5 && (h.includes(w) || w.includes(h))) return true;
    }
  }
  return false;
}
