/**
 * Extract the number of on-site days per week from a job description.
 *
 * Employers often write the hybrid split in prose (e.g. "3 days onsite",
 * "2-3 days in the office") rather than filling a structured field. This
 * parser returns a numeric day count for the first explicit mention it finds,
 * so the public facts block and apply panel can be precise.
 *
 * Examples:
 *   "hybrid (3 days onsite)" -> 3
 *   "2 days on-site per week"  -> 2
 *   "3-4 days in the office"   -> 3
 *   "fully remote"             -> null
 */
export function extractOnsiteDays(description: string): number | null {
  if (!description) return null;
  const normalized = description.toLowerCase();

  // "(3 days onsite)", "3 days on-site", "3 days in the office", "3-4 days onsite"
  const rangeMatch = normalized.match(/(\d+)(?:\s*[-–]\s*\d+)?\s*(?:days?|day)\s*(?:onsite|on-site|in\s+the\s+office|in\s+office)/);
  if (rangeMatch) {
    return parseInt(rangeMatch[1], 10);
  }

  // "onsite 3 days a week"
  const trailingMatch = normalized.match(/(?:onsite|on-site)\s*(?:for\s*)?(\d+)\s*(?:days?|day)/);
  if (trailingMatch) {
    return parseInt(trailingMatch[1], 10);
  }

  return null;
}
