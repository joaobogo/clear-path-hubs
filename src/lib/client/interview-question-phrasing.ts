/**
 * Turns a requirement label into a question that reads as English.
 *
 * Requirement labels are usually phrases, not nouns, so a single template
 * ("...your experience with {requirement}") produces ungrammatical questions.
 * We pick a frame based on how the phrase starts:
 *  - "Experience ..."      -> "Tell me about your experience ..."
 *  - verb / gerund start   -> "Tell me about ..."
 *  - adjective start       -> "Tell me about a time you were ..."
 *  - bare noun phrase      -> "Can you walk me through your experience with ...?"
 */

import { SYNONYM_TABLE } from "@/lib/scoring/term-synonyms";

const EXPERIENCE_PREFIX =
  /^(practical|proven|demonstrated|hands[- ]on|strong|solid|significant|prior|previous|deep|extensive|relevant)?\s*experience\b/i;

const BASE_VERBS = new Set([
  "own", "owns", "build", "builds", "ship", "ships", "lead", "leads", "manage",
  "manages", "work", "works", "deliver", "delivers", "write", "writes",
  "design", "designs", "scale", "scales", "mentor", "mentors", "communicate",
  "collaborate", "drive", "drives", "run", "runs", "handle", "handles",
  "maintain", "maintains", "support", "supports", "operate", "operates",
  "translate", "translates", "partner", "partners", "coach", "coaches",
]);

/**
 * Past-tense verb starts. "Worked on multi-tenant SaaS…" fell through every
 * frame and came out as "Tell me about worked on multi-tenant SaaS…" (audit
 * #4, L8). Listed explicitly rather than matched on an "-ed" ending, because
 * requirement labels open with -ed adjectives just as often ("Advanced SQL",
 * "Distributed systems", "Automated testing") and those need the noun frame.
 */
const PAST_VERBS = new Set([
  "worked", "built", "shipped", "led", "managed", "owned", "delivered",
  "wrote", "designed", "scaled", "mentored", "ran", "handled", "maintained",
  "supported", "operated", "migrated", "launched", "implemented", "developed",
  "created", "architected", "deployed", "integrated", "refactored",
  "optimised", "optimized", "drove", "coached", "partnered", "collaborated",
  "translated", "rebuilt", "rewrote", "grew", "hired",
]);

const ADJECTIVES = new Set([
  "comfortable", "familiar", "fluent", "able", "willing", "experienced",
  "proficient", "skilled", "capable", "confident", "competent", "adept",
  "eager", "available", "autonomous", "hands-on", "pragmatic", "curious",
]);

/**
 * Job-ad framing that belongs to the advert, not to the requirement. Left in,
 * it lands inside the question ("...your experience with must have 5+ years of
 * Python?"), so it comes off the front before a frame is chosen.
 */
const OBLIGATION_PREFIX =
  /^(?:you(?:'ll| will)?\s+(?:be\s+)?(?:expected\s+to|need\s+to)?|we(?:'re| are)\s+looking\s+for|looking\s+for|seeking|must\s+have|should\s+have|nice\s+to\s+have|required?:?|requirement:?|essential:?|desirable:?)\s+/i;

function clean(label: string): string {
  const base = label.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
  const stripped = base.replace(OBLIGATION_PREFIX, "").trim();
  // Never strip the whole label away — a label that IS the prefix stays as-is.
  return stripped || base;
}

/**
 * Product names that carry exactly one capital, so the shape tests below
 * cannot tell them from an ordinary sentence-cased word. Read from the scoring
 * engine's synonym table rather than re-listed here: that table already
 * enumerates the technologies these labels name, and one list cannot drift
 * from itself. Without this, "Nice to have Kubernetes exposure" became
 * "...your experience with kubernetes exposure?" (audit #4, L8).
 */
const KNOWN_PRODUCTS = new Set(
  Object.entries(SYNONYM_TABLE)
    .flatMap(([canonical, aliases]) => [canonical, ...aliases])
    .map((t) => t.toLowerCase()),
);

function lowerFirst(text: string): string {
  if (!text) return text;
  const [first, ...rest] = text.split(" ");
  // Keep acronyms and proper nouns intact (SQL, TypeScript, AWS).
  if (/^[A-Z]{2,}$/.test(first) || /[A-Z]/.test(first.slice(1))) return text;
  // Keep a capitalised product name capitalised (Kubernetes, Docker, Python).
  if (/^[A-Z]/.test(first) && KNOWN_PRODUCTS.has(first.toLowerCase().replace(/[.,;:]+$/, ""))) {
    return text;
  }
  return [first.charAt(0).toLowerCase() + first.slice(1), ...rest].join(" ");
}

function words(label: string): string[] {
  return label.split(/[\s/]+/).filter(Boolean);
}

function isGerund(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z-]/g, "");
  return w.length > 4 && w.endsWith("ing");
}

export function phraseInterviewQuestion(rawLabel: string): string {
  const label = clean(rawLabel ?? "");
  if (!label) return "Tell me about your relevant experience.";

  // "Experience owning features..." / "Practical experience with RLS..."
  if (EXPERIENCE_PREFIX.test(label)) {
    return `Tell me about your ${lowerFirst(label)}.`;
  }

  const parts = words(label);
  const first = parts[0]!.toLowerCase().replace(/[^a-z-]/g, "");

  // "Ability to ..." / "Able to ..."
  if (first === "ability" || first === "able") {
    return `Tell me about how you have shown the ${lowerFirst(label).replace(/^able to/i, "ability to")}.`;
  }

  if (ADJECTIVES.has(first)) {
    return `Tell me about a time you were ${lowerFirst(label)}.`;
  }

  if (isGerund(first)) {
    return `Tell me about ${lowerFirst(label)}.`;
  }

  if (BASE_VERBS.has(first)) {
    return `Tell me about how you ${lowerFirst(label)}.`;
  }

  // "Worked on ...", "Led a team of ..." — the label already reads as
  // something the candidate did, so it needs a subject in front of it.
  if (PAST_VERBS.has(first)) {
    return `Tell me about when you ${lowerFirst(label)}.`;
  }

  // Everything reaching here starts with something that is not a verb, so the
  // noun frame is the grammatical one.
  //
  // This used to be gated on "no verb-looking word anywhere in the phrase",
  // which misread gerund NOUNS — the "modelling" in "data modelling", the
  // "tuning" in "performance tuning" — as verbs and dropped those labels into
  // the "Tell me about ..." frame, producing "Tell me about strong knowledge
  // of relational databases and data modelling." (audit #4, L8). A verb-initial
  // label never gets this far; the branches above have all claimed it.
  return `Can you walk me through your experience with ${lowerFirst(label)}?`;
}
