/**
 * Single source of truth for machine-readable indexing surfaces.
 *
 * Both /sitemap.xml and /robots.txt are generated from this module family at
 * request time, so a route added here can never be advertised in one file and
 * missing from the other. The static public/robots.txt copy is regenerated at
 * build time from the same robots-config.ts source.
 */
import { CANONICAL_ORIGIN } from "@/lib/canonical-origin";
import { listIndustrySlugs } from "@/lib/marketing/content";
import { listAllBlogRows } from "@/lib/marketing/blog-catalog";
import { listResourceGuideSlugs } from "@/content/resources";
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";
import { BLOG_CATEGORY_BY_SLUG } from "@/lib/marketing/blog-manifest";
import { BASE_URL, SITEMAP_URL } from "@/lib/seo/robots-config";
export { buildRobotsTxt } from "@/lib/seo/robots-config";

/** Canonical production origin — shared with every `rel=canonical` tag. */
export { BASE_URL, SITEMAP_URL };




// Intentional exclusions — nothing that emits `noindex` may appear below.
// - /login, /reset-password, /access-denied, /unauthorized: auth plumbing.
// - /admin/*, /client/*, /me/*, /boardroom, /checkout, /book-call: behind the
//   authenticated route gate, `noindex` on the whole subtree.
// - /brand-center, /dev/*: internal tooling, `noindex` + disallowed below.
// - /jobs/$id and /jobs/$id/apply: per-role pages carry `noindex`.
// - /apply/*, /intake/confirmation, /share/$token: post-submission / tokenised.
// - /auth, /pilot/intake, /industries/non-profit, legacy short industry slugs:
//   redirects, so only the destination is listed.
export const STATIC_PATHS = [
  "/",
  "/solutions",
  "/how-it-works",
  "/journey",
  "/pricing",
  "/about",
  "/enterprise",
  "/pilot",
  "/contact",
  "/faq",
  "/resources",
  "/case-studies",
  "/global-talent",
  "/employer-onboarding",
  "/knowledge-base",
  "/talent-network",
  "/partnerships/staffing",
  "/privacy",
  "/terms",
  "/sitemap",
  "/industries",
  "/blog",
  "/jobs",
  "/platform",
  "/agents",
  "/integrations",
  "/system",
  "/trust",
  "/security",
  "/status",
  "/changelog",

  "/intake",
  "/book",
  "/talent-marketplace",
  "/candidate-join",
  "/candidate-success",
  "/pitch",
] as const;


export type SitemapEntry = { path: string; priority: string };

/** Every indexable URL, derived from routes plus published dynamic content. */
export function collectSitemapEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = STATIC_PATHS.map((path) => ({
    path,
    priority: path === "/" ? "1.0" : "0.8",
  }));

  // Emit only canonical (public) industry slugs; legacy slugs 301 to these.
  const industries = new Set<string>();
  for (const slug of listIndustrySlugs()) industries.add(toPublicSlug(slug));
  for (const slug of industries) entries.push({ path: `/industries/${slug}`, priority: "0.7" });
  for (const slug of industries) {
    entries.push({ path: `/industries/${slug}/briefing`, priority: "0.6" });
  }

  // Authority library pillar guides at /resources/<slug>.
  for (const slug of listResourceGuideSlugs()) {
    entries.push({ path: `/resources/${slug}`, priority: "0.7" });
  }

  for (const categorySlug of Object.keys(BLOG_CATEGORY_BY_SLUG)) {
    entries.push({ path: `/blog/category/${categorySlug}`, priority: "0.5" });
  }
  // Only posts the blog actually publishes — /blog/$slug 404s otherwise, and
  // listing them here would advertise soft-404s to crawlers.
  for (const row of listAllBlogRows()) {
    entries.push({ path: `/blog/${row.slug}`, priority: "0.6" });
  }

  return entries;
}

export function buildSitemapXml(): string {
  const urls = collectSitemapEntries().map((e) =>
    [
      "  <url>",
      `    <loc>${BASE_URL}${e.path}</loc>`,
      "    <changefreq>weekly</changefreq>",
      `    <priority>${e.priority}</priority>`,
      "  </url>",
    ].join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

