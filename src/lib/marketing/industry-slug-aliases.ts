/**
 * Canonical public slugs for industries.
 *
 * The internal data set in `src/content/industries-v2.ts` uses short
 * legacy slugs (e.g. `tech`, `ecommerce`). Search engines and the
 * SEO audit prefer the full human-readable form. We keep the data
 * unchanged and translate at the routing / sitemap / link boundary.
 *
 * - Old slugs 301 → new slugs (see `src/routes/industries.$slug.tsx`).
 * - Sitemap emits only new slugs.
 * - Internal `<Link>` params run through `toPublicSlug()`.
 */

export const INDUSTRY_SLUG_ALIASES: Record<string, string> = {
  tech: "technology",
  ecommerce: "e-commerce",
  telecom: "telecommunications",
};

/** Map any data-side slug to its public canonical form. */
export function toPublicSlug(slug: string): string {
  return INDUSTRY_SLUG_ALIASES[slug] ?? slug;
}

/** Reverse map: public URL slug → data-side lookup key. */
export function toInternalSlug(slug: string): string {
  for (const [internal, public_] of Object.entries(INDUSTRY_SLUG_ALIASES)) {
    if (public_ === slug) return internal;
  }
  return slug;
}

/** True if the given slug is a deprecated alias that should 301 to canonical. */
export function isLegacyIndustrySlug(slug: string): boolean {
  return slug in INDUSTRY_SLUG_ALIASES;
}
