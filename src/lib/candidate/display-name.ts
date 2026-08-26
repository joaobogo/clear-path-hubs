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
