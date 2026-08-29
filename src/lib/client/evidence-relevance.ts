import { expandTerm } from "@/lib/scoring/term-synonyms";
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

/**
 * Two-letter terms that are real subjects, not noise. The blanket 3-character
 * floor below deleted them, so "Understanding of good UX/UI principles" had NO
 * subject tokens at all and no passage could ever support it (audit #4, M14).
 */
const SHORT_SUBJECTS = new Set([
  "ux", "ui", "ai", "ml", "qa", "bi", "go", "r", "c",
  // Portuguese abbreviations of the same disciplines. "IA" is how a Brazilian
  // CV writes AI, and the blanket three-character floor deleted it, so a
  // passage naming AI tools in Portuguese had nothing left to match on
  // (audit #4, M14).
  "ia", "ux/ui", "bd",
]);

/**
 * Strip diacritics so "inglês" and "ingles" are the same token.
 *
 * The character class below removes anything outside [a-z0-9], and it ran
 * BEFORE any folding — so "inglês" was cut into "ingl" and "s", and no amount
 * of synonym expansion could match it. Every Portuguese quote for a language,
 * a specialisation or a tool was silently dropped from the client's evidence,
 * which is why Partial rows with real quotes rendered as "Not evidenced yet"
 * (audit #4, M14).
 */
function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tokens(text: string): string[] {
  return foldAccents(text.toLowerCase())
    .replace(/[^a-z0-9+#.\- ]+/g, " ")
    .split(/[\s.]+/)
    .map((t) => t.replace(/^[-+.]+|[-+.]+$/g, ""))
    .filter((t) => (t.length >= 3 || SHORT_SUBJECTS.has(t)) && !GENERIC.has(t));
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
    // Framing words: they say how well the candidate should know the subject,
    // never what the subject is. "Understanding of good UX/UI principles"
    // matched a passage about understanding CLIENT REQUIREMENTS purely on the
    // word "understand" (audit #4, H5).
    "understanding",
    "understand",
    "understands",
    "knowledge",
    "familiarity",
    "awareness",
    "grasp",
    "appreciation",
    "exposure",
    "proficiency",
    "competence",
    "principles",
    "fundamentals",
    "basics",
  ].map(stem),
);

/**
 * A subject term specific enough to carry a passage on its own.
 *
 * "Understanding of practical web security fundamentals" shares the token
 * "web" with "building web applications using React" — a passage about
 * frontend work, offered to a client as proof of security knowledge (audit #4,
 * H5). A short, common token is real but weak: on its own it means the passage
 * merely touches the same area, so a second hit is required. A long token, or
 * a named discipline like UX, is specific enough by itself.
 */
function isSpecific(term: string): boolean {
  return term.length >= 6 || SHORT_SUBJECTS.has(term);
}

/**
 * Substring matching is for compound forms ("row-level" vs "rowlevel"), and it
 * needs a long enough needle to mean anything. Applied to two-letter terms it
 * found "ui" inside "req(ui)rements" and "b(ui)lding", which is how a passage
 * about understanding client requirements became proof of UX/UI principles
 * (audit #4, H5). Short terms must match as whole words.
 */
const MIN_SUBSTRING_TERM = 4;

function looseMatch(w: string, have: Set<string>): boolean {
  if (have.has(w)) return true;
  // Allow compound forms: "row-level" vs "rowlevel", "founder-led" vs "founderled".
  if (w.length >= MIN_SUBSTRING_TERM) {
    for (const h of have) {
      if (h.length >= 5 && (h.includes(w) || w.includes(h))) return true;
    }
  }
  // The ENGINE credited this passage through its synonym table (which knows
  // "segurança" is security and "k8s" is kubernetes). This display-side check
  // must not then drop the quote for lacking an English token, or the client
  // reads "not evidenced" for a requirement the run scored as met — which is
  // exactly what happened to both Portuguese CVs (audit #4, M14).
  for (const raw of expandTerm(w)) {
    // The table stores accented surface forms ("inglês", "experiência do
    // usuário"); `have` is folded AND stemmed, so the forms must be too or
    // "ferramentas" can never meet the stored "ferramenta".
    const form = stem(foldAccents(raw));
    if (have.has(form)) return true;
    // A multi-word alias ("fluxo de trabalho") never equals a single token —
    // check whether the passage contains all of its parts instead.
    if (form.includes(" ")) {
      const parts = form.split(/\s+/).map(stem).filter((p) => p.length >= 3);
      if (parts.length > 0 && parts.every((p) => have.has(p))) return true;
      continue;
    }
    // Same needle-length rule as above: an expanded form is still a term.
    if (form.length < MIN_SUBSTRING_TERM) continue;
    for (const h of have) {
      if (h.length >= 5 && (h.includes(form) || form.includes(h))) return true;
    }
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

  // The requirement's subject terms. When it has any, the passage must hit
  // them; attitude and framing words on their own never carry a quote.
  const subject = [...wanted].filter((w) => !SOFT.has(w));
  if (subject.length > 0) {
    const matched = subject.filter((w) => looseMatch(w, have));
    if (matched.length === 0) return false;
    // One specific term is proof enough. One weak, common term is not — it
    // only says the passage is in the same neighbourhood, so a second subject
    // hit has to back it up.
    return matched.some(isSpecific) || matched.length >= 2;
  }

  for (const w of wanted) {
    if (have.has(w)) return true;
    for (const h of have) {
      if (h.length >= 5 && (h.includes(w) || w.includes(h))) return true;
    }
  }
  return false;
}
