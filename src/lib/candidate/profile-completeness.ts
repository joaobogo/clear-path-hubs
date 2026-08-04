/**
 * Single source of truth for the candidate profile completeness percentage,
 * shared by the candidate home page and the profile editor so both always
 * report the same number.
 */
export function profileCompleteness(
  p: Record<string, unknown> | null | undefined,
): number {
  if (!p) return 0;
  const checks = [
    !!p.full_name,
    !!p.phone,
    !!p.location,
    !!p.headline,
    !!p.summary,
    (p.years_experience ?? null) !== null,
    Array.isArray(p.skills) && (p.skills as unknown[]).length > 0,
    Array.isArray(p.experience) && (p.experience as unknown[]).length > 0,
    Array.isArray(p.education) && (p.education as unknown[]).length > 0,
    !!p.linkedin_url || !!p.portfolio_url,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
