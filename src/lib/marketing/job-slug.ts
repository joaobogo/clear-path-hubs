/**
 * Human-readable job URL helpers.
 *
 * URL shape: `/jobs/{title-slug}-{location-slug?}-{uuid}`
 *
 * The trailing UUID is the stable job identifier; we always extract it
 * for the database lookup so bare `/jobs/{uuid}` URLs keep working
 * (they 301 to the slugged canonical form).
 */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function slugify(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Extract the trailing UUID from a URL param (returns raw param if none). */
export function extractJobUuid(param: string): string {
  const match = param.match(UUID_RE);
  return match ? match[0] : param;
}

/** Build canonical slugged param `/jobs/{slug}` from a position. */
export function buildJobSlug(pos: {
  id: string;
  title: string;
  location?: string | null;
}): string {
  const parts = [slugify(pos.title), slugify(pos.location ?? ""), pos.id]
    .filter(Boolean);
  return parts.join("-");
}

export function isBareUuid(param: string): boolean {
  return UUID_RE.test(param) && param.replace(UUID_RE, "").replace(/[-\s]/g, "") === "";
}
