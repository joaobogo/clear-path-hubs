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

const ADJECTIVES = new Set([
  "comfortable", "familiar", "fluent", "able", "willing", "experienced",
  "proficient", "skilled", "capable", "confident", "competent", "adept",
  "eager", "available", "autonomous", "hands-on", "pragmatic", "curious",
]);

function clean(label: string): string {
  return label.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
}

function lowerFirst(text: string): string {
  if (!text) return text;
  const [first, ...rest] = text.split(" ");
  // Keep acronyms and proper nouns intact (SQL, TypeScript, AWS).
  if (/^[A-Z]{2,}$/.test(first) || /[A-Z]/.test(first.slice(1))) return text;
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

  const hasVerbish = parts.some((w) => isGerund(w) || BASE_VERBS.has(w.toLowerCase()));

  // Bare noun phrase: short and no verb in sight.
  if (!hasVerbish && parts.length <= 6) {
    return `Can you walk me through your experience with ${lowerFirst(label)}?`;
  }

  return `Tell me about ${lowerFirst(label)}.`;
}
