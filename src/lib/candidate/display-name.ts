/**
 * Derives the name shown in candidate-facing greetings from a stored full name.
 *
 * Names containing brackets must never corrupt the greeting: matched bracketed
 * segments ("[QA]", "(test)") are stripped as whole segments, and any stray
 * unmatched bracket characters are dropped, rather than splitting the raw
 * string on whitespace and rendering a dangling "[".
 */
export function greetingName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const cleaned = fullName
    // Drop matched bracketed segments entirely — they are markers, not name parts.
    .replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|<[^>]*>/g, " ")
    // Drop any remaining stray bracket characters.
    .replace(/[[\](){}<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

/**
 * Name particles that stay lower case when they are not the first token —
 * the Portuguese, Spanish, Italian and Dutch convention: "Maria dos Santos
 * da Silva", not "Maria Dos Santos Da Silva".
 */
const NAME_PARTICLES = new Set([
  "da", "das", "de", "del", "della", "di", "do", "dos", "du",
  "e", "la", "le", "van", "von", "der", "den", "y",
]);

function capitalizeChunk(chunk: string): string {
  if (!chunk) return chunk;
  const cased = chunk.slice(0, 1).toUpperCase() + chunk.slice(1).toLowerCase();
  // "O'Brien", "D'Angelo": a single-letter prefix before an apostrophe keeps
  // the following letter capitalised. Longer prefixes ("l'") do not.
  return cased.replace(
    /^([A-Za-zÀ-ÿ])(['’])(.)/u,
    (_all, prefix: string, quote: string, next: string) =>
      prefix + quote + next.toUpperCase(),
  );
}

/**
 * Display casing for a person's name. RENDER ONLY.
 *
 * The stored value is never rewritten: it is what the person typed or what
 * the CV parser read, and it is the record. Screens print
 * "PEDRO GRADOWSKI MARTINS" beside "gustavo paçó costa" because each surface
 * echoes that raw string. Every surface that prints a name calls this instead.
 *
 * Only tokens that are ENTIRELY upper case or entirely lower case are
 * re-cased. A token whose case was deliberately mixed ("McDonald",
 * "DeSouza") is already a decision and is returned untouched.
 *
 * toUpperCase/toLowerCase are used deliberately, NOT their toLocale*
 * variants: the plain methods are locale-invariant, so a Turkish-locale
 * server and an English browser agree. Calling toLocaleUpperCase() without
 * an explicit locale is what would make them disagree.
 */
export function formatPersonName(name: string | null | undefined): string {
  const cleaned = (name ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((token, index) => {
      const lower = token.toLowerCase();
      if (token !== lower && token !== token.toUpperCase()) return token;
      if (index > 0 && NAME_PARTICLES.has(lower)) return lower;
      // Hyphenated given names capitalise on both sides: "Jean-Luc".
      return lower.split("-").map(capitalizeChunk).join("-");
    })
    .join(" ");
}
