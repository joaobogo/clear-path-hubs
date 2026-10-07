/**
 * Light-weight indexability constants. Kept apart from `index-config.ts` (which
 * pulls every blog and guide into its import graph) so route heads can import
 * them without bloating a route chunk. `index-config.ts` re-exports everything
 * here.
 */
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";

/**
 * Static public paths that emit `noindex` in their route head, so they stay out
 * of the sitemap. Shared by the sitemap generator and by the route heads/tests
 * so the two cannot drift apart.
 */
export const NOINDEX_STATIC_PATHS = [
  "/status",
  "/changelog",
  "/candidate-success",
  "/knowledge-base",
  "/talent-marketplace",
  "/global-talent",
  "/pitch",
  "/sitemap",
  "/book",
  "/intake",
  "/sample-shortlist",
] as const;

/**
 * Industry slugs (public form) whose landing page and briefing are indexable.
 * Every other industry page and briefing is `noindex, follow` and out of the
 * sitemap. To publish another industry, add its public slug here.
 */
export const INDEXABLE_INDUSTRY_SLUGS: readonly string[] = ["hospitality", "healthcare"];

export function isIndexableIndustrySlug(slug: string): boolean {
  return INDEXABLE_INDUSTRY_SLUGS.includes(toPublicSlug(slug));
}

/** Value for the robots meta tag on a non-indexable industry page. */
export const INDUSTRY_NOINDEX_ROBOTS = "noindex, follow" as const;

