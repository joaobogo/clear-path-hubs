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
      // Separator runs (", ", " ") are returned untouched so normalised
      // spacing survives the re-join.
      if (!trimmed || /^[,\s]+$/.test(token)) return token;

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
 * Remove redundant location pieces. A part is dropped when it is empty, an
 * exact duplicate, or a substring of a part already kept (e.g. "Lisbon"
 * inside "Lisbon Metropolitan Area"). Order is preserved.
 */
export function dedupeLocationParts(parts: (string | null | undefined)[]): string[] {
  const kept: string[] = [];
  for (const raw of parts) {
    const part = raw?.trim();
    if (!part) continue;
    const lower = part.toLowerCase();
    if (kept.some((k) => k.toLowerCase() === lower || k.toLowerCase().includes(lower))) continue;
    kept.push(part);
  }
  return kept;
}

/**
 * Normalise an already-joined location string by splitting on commas (or dashes
 * used as separators) and removing duplicate pieces. Returns null when nothing
 * useful remains.
 */
export function normalizeLocationString(input: string | null | undefined): string | null {
  if (!input) return null;
  const parts = input
    .split(/\s*[,\-]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const deduped = dedupeLocationParts(parts);
  return deduped.join(", ") || null;
}

/**
 * Format a single location line from city/region/country pieces.
 * Handles missing pieces and preserves acronyms.
 */
export function formatLocationLine(parts: (string | null | undefined)[]): string {
  return dedupeLocationParts(
    parts.filter((p): p is string => !!p).map((p) => titleCaseLocation(p.trim())),
  ).join(", ");
}

const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brazil",
  US: "United States",
  GB: "United Kingdom",
  PT: "Portugal",
  ES: "Spain",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  IE: "Ireland",
  CA: "Canada",
  PL: "Poland",
};

/**
 * The posting's own `location` string is the single source of truth for where a
 * role is hired. Some records omit the country ("Curitiba, PR"), so we append it
 * from the structured location row — but ONLY when that row describes the same
 * city. A row that names a different city is stale and must never rewrite the
 * public fact.
 */
export function withCountry(
  location: string | null | undefined,
  row: { city?: string | null; country?: string | null; country_code?: string | null } | null | undefined,
): string {
  const place = (location ?? "").trim();
  if (!place || !row) return place;
  const city = (row.city ?? "").trim();
  const code = (row.country_code ?? "").trim().toUpperCase();
  const countryName = (row.country ?? "").trim();
  const country = COUNTRY_NAMES[code] || countryName;
  if (!city || !country) return place;
  if (!place.toLowerCase().includes(city.toLowerCase())) return place;
  if (place.toLowerCase().includes(country.toLowerCase())) return place;
  return `${place}, ${country}`;
}

/**
 * The ONE way a location is written for candidates: "City, Country".
 *
 * Records arrive in every shape — "Curitiba, Paraná, BR", "Curitiba, PR,
 * Brazil", "Lisbon, Portugal" — so the string is rebuilt from its parts. A
 * country code is resolved to its country name, the country is never repeated,
 * and a code is never mixed with a name.
 */
export function canonicalLocation(
  location: string | null | undefined,
  row?: { city?: string | null; region?: string | null; country?: string | null; country_code?: string | null } | null,
): string {
  const raw = (location ?? "").trim();
  const parts = raw
    ? raw.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean)
    : [];

  const countryFromToken = (token: string): string | null => {
    const upper = token.toUpperCase();
    if (COUNTRY_NAMES[upper]) return COUNTRY_NAMES[upper];
    const known = Object.values(COUNTRY_NAMES).find(
      (name) => name.toLowerCase() === token.toLowerCase(),
    );
    return known ?? null;
  };

  const rowCity = (row?.city ?? "").trim();
  const rowCode = (row?.country_code ?? "").trim().toUpperCase();
  const rowCountry = (row?.country ?? "").trim();

  let country: string | null =
    (rowCode ? COUNTRY_NAMES[rowCode] ?? null : null) ??
    (rowCountry ? countryFromToken(rowCountry) ?? rowCountry : null);
  if (!country) {
    for (const part of parts) {
      const resolved = countryFromToken(part);
      if (resolved) country = resolved;
    }
  }

  // A part that only names the country (or a country code) is dropped; the
  // first remaining part is the place.
  const placeParts = parts.filter((part) => !countryFromToken(part));
  let city = placeParts[0] ?? "";
  if (rowCity && (!city || placeParts.some((p) => p.toLowerCase() === rowCity.toLowerCase()))) {
    city = rowCity;
  }

  if (!city && !country) return titleCaseLocation(raw);
  return formatLocationLine([city || null, country]);
}
