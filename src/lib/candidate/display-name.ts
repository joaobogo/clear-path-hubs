/**
 * Derives the name shown in candidate-facing greetings from a stored full name.
 *
 * Names containing bracketed markers ("[QA]", "(test)", "<demo>") must never
 * corrupt the greeting: the markers are stripped as whole segments and the
 * remaining name is cleaned, rather than splitting the raw string on
 * whitespace and rendering a dangling "[".
 */
export function greetingName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const cleaned = fullName
    // Drop bracketed segments entirely — they are markers, not name parts.
    .replace(/[[\](){}<>][^\s[\](){}<>]*[[\](){}<>]?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}
