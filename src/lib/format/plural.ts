/**
 * Pluralization helper for UI strings.
 *
 * Usage:
 *   plural(1, "candidate") // "1 candidate"
 *   plural(2, "candidate") // "2 candidates"
 *   plural(1, "role", "roles") // "1 role"
 *   plural(2, "role", "roles") // "2 roles"
 */
export function plural(count: number, singular: string, pluralOverride?: string): string {
  if (count === 1) return `1 ${singular}`;
  const p = pluralOverride || `${singular}s`;
  return `${count} ${p}`;
}

/**
 * Returns just the word form (singular or plural) based on the count.
 *
 * Usage:
 *   pluralWord(1, "role") // "role"
 *   pluralWord(2, "role") // "roles"
 */
export function pluralWord(count: number, singular: string, pluralOverride?: string): string {
  if (count === 1) return singular;
  return pluralOverride || `${singular}s`;
}
