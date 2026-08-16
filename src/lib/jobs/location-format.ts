/**
 * Location-aware title casing.
 *
 * Normal title-casing lowercases every word after the first letter, which
 * destroys region acronyms such as PR, IL, NY, and BR-PT state codes. This
 * helper keeps short, all-caps tokens uppercase while still title-casing
 * regular words.
 *
 * Examples:
 *   "chicago, il, united states" -> "Chicago, IL, United States"
 *   "curitiba, pr, brazil"       -> "Curitiba, PR, Brazil"
 *   "north carolina"             -> "North Carolina"
 *   "new york"                   -> "New York"
 */
export function titleCaseLocation(input: string): string {
  if (!input) return input;
  // Raw records often store "Chicago,IL,United States" with no space after the
  // comma. Normalise separators before casing so the fact reads as a sentence.
  return input
    .replace(/\s*,\s*/g, ", ")
    .split(/([,\s]+)/)
    .map((token) => {
      const trimmed = token.trim();
      if (!trimmed) return token;
      // Keep already-all-caps tokens (acronyms) as-is, e.g. IL, PR, NY.
      if (/^[A-Z]{2,}$/.test(trimmed)) return trimmed;
      // Keep mixed-case acronyms like "São Paulo" mostly intact but title-case
      // the first letter of each word.
      return trimmed
        .split(/\s+/)
        .map((word) => {
          if (!word) return word;
          if (/^[A-Z]{2,}$/.test(word)) return word;
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
    })
    .join("");
}

/**
 * Format a single location line from city/region/country pieces.
 * Handles missing pieces and preserves acronyms.
 */
export function formatLocationLine(parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => !!p)
    .map((p) => titleCaseLocation(p.trim()))
    .join(", ");
}
