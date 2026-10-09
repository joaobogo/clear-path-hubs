/**
 * The "I'm hiring a …" role input carries what the visitor typed to Intake as
 * `?role=`. One cleaner for both ends, so a pasted paragraph or markup never
 * lands in the job title.
 */
export const ROLE_INPUT_MAX = 80;

export function cleanRole(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(an?|the)\s+/i, "")
    .slice(0, ROLE_INPUT_MAX)
    .trim();
}

/** `?role=` value, cleaned, or undefined when absent or empty. */
export function roleFromSearch(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const role = cleanRole(value);
  return role || undefined;
}
