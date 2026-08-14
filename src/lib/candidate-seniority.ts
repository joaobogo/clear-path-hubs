/**
 * Candidate seniority is DERIVED, not stored.
 *
 * `candidate_profiles` has no `seniority` column by design — the canonical
 * signal is `years_experience` (seniority wording on a role lives on
 * `positions.seniority`). Every surface that shows or filters candidate
 * seniority must go through these helpers so the bands stay consistent.
 */

export const SENIORITY_BANDS = ["Junior", "Mid", "Senior", "Lead"] as const;
export type SeniorityBand = (typeof SENIORITY_BANDS)[number];

/** Map years of experience to a band. Returns null when we don't know. */
export function seniorityFromYears(years: unknown): SeniorityBand | null {
  const n =
    typeof years === "number"
      ? years
      : typeof years === "string" && years.trim() !== ""
        ? Number(years)
        : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 3) return "Junior";
  if (n < 6) return "Mid";
  if (n < 10) return "Senior";
  return "Lead";
}

/** Sort helper so facet lists read Junior → Lead instead of alphabetically. */
export function compareSeniority(a: string, b: string): number {
  const ia = SENIORITY_BANDS.indexOf(a as SeniorityBand);
  const ib = SENIORITY_BANDS.indexOf(b as SeniorityBand);
  return (ia < 0 ? SENIORITY_BANDS.length : ia) - (ib < 0 ? SENIORITY_BANDS.length : ib);
}
