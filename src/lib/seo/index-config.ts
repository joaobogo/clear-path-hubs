/**
 * Single source of truth for machine-readable indexing surfaces.
 *
 * Both /sitemap.xml and /robots.txt are generated from this module family at
 * request time, so a route added here can never be advertised in one file and
 * missing from the other. The static public/robots.txt copy is regenerated at
 * build time from the same robots-config.ts source.
 */
import { blog, getPage, listIndustrySlugs } from "@/lib/marketing/content";
import { listAllBlogRows } from "@/lib/marketing/blog-catalog";
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";
import { RESOURCE_GUIDES } from "@/content/resources";
import { BLOG_CATEGORY_BY_SLUG } from "@/lib/marketing/blog-manifest";
import { BASE_URL, SITEMAP_URL } from "@/lib/seo/robots-config";
import { isIndexableIndustrySlug } from "@/lib/seo/indexability";
export {
  INDEXABLE_INDUSTRY_SLUGS,
  INDUSTRY_NOINDEX_ROBOTS,
  NOINDEX_STATIC_PATHS,
  isIndexableIndustrySlug,
} from "@/lib/seo/indexability";
export { buildRobotsTxt } from "@/lib/seo/robots-config";

/** Canonical production origin — shared with every `rel=canonical` tag. */
export { BASE_URL, SITEMAP_URL };

// Intentional exclusions — nothing that emits `noindex` may appear below.
// - NOINDEX_STATIC_PATHS above: thin or utility pages.
// - /login, /reset-password, /access-denied, /unauthorized: auth plumbing.
// - /admin/*, /client/*, /me/*, /boardroom, /checkout, /book-call: behind the
//   authenticated route gate, `noindex` on the whole subtree.
// - /brand-center, /dev/*: internal tooling, `noindex` + disallowed.
// - /jobs/$id and /jobs/$id/apply: per-role pages carry `noindex`.
// - /apply/*, /intake/confirmation, /share/$token: post-submission / tokenised.
// - /auth, /pilot/intake, /industries/non-profit, legacy short industry slugs:
//   redirects, so only the destination is listed.
// - Industry pages and briefings outside INDEXABLE_INDUSTRY_SLUGS.
// - /blog?page=N: paginated archive views self-canonicalise but are not listed.
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
  "/employer-onboarding",
  "/talent-network",
  "/partnerships/staffing",
  "/privacy",
  "/terms",
  "/industries",
  "/blog",
  "/jobs",
  "/platform",
  "/agents",
  "/integrations",
  "/system",
  "/trust",
  "/security",
  "/ai-in-hiring",
  "/flat-fee-recruiting",
  "/subscription-recruiting",
  "/recruitment-agency-alternative",
  "/ai-recruiting-agency",
  "/recruiting-as-a-service",
  "/candidate-join",
] as const;

/**
 * `lastmod` is emitted only when a real date exists (blog dates, resource
 * guide revisions, content-entry dates). It is never defaulted to "today".
 * `changefreq` and `priority` are intentionally not emitted: search engines
 * ignore them.
 */
export type SitemapEntry = { path: string; lastmod?: string };
export type SitemapGroup = "pages" | "industries" | "blog";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

/** A valid W3C datetime string, or undefined. */
export function toLastmod(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (!ISO_DATE.test(v)) return undefined;
  return Number.isNaN(Date.parse(v)) ? undefined : v.replace(" ", "T");
}

function newest(...dates: Array<string | undefined>): string | undefined {
  const valid = dates.map(toLastmod).filter((d): d is string => !!d);
  return valid.sort().at(-1);
}

function pageEntryDate(path: string): string | undefined {
  const slug = path === "/" ? "index" : path.replace(/^\//, "").replace(/\//g, "-");
  const meta = getPage(slug)?.meta as Record<string, string | undefined> | undefined;
  return newest(meta?.["article:modified_time"], meta?.["article:published_time"]);
}

export function collectPageEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = STATIC_PATHS.map((path) => ({
    path,
    lastmod: pageEntryDate(path),
  }));
  // Authority library pillar guides at /resources/<slug>.
  for (const guide of RESOURCE_GUIDES) {
    entries.push({ path: `/resources/${guide.slug}`, lastmod: toLastmod(guide.updated) });
  }
  return entries;
}

export function collectIndustryEntries(): SitemapEntry[] {
  // Emit only canonical (public) industry slugs; legacy slugs 301 to these.
  const industries = new Set<string>();
  for (const slug of listIndustrySlugs()) industries.add(toPublicSlug(slug));
  const entries: SitemapEntry[] = [];
  for (const slug of industries) {
    if (!isIndexableIndustrySlug(slug)) continue;
    entries.push({ path: `/industries/${slug}` });
    entries.push({ path: `/industries/${slug}/briefing` });
  }
  return entries;
}

export function collectBlogEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  for (const categorySlug of Object.keys(BLOG_CATEGORY_BY_SLUG)) {
    entries.push({ path: `/blog/category/${categorySlug}` });
  }
  // Only posts the blog actually publishes — /blog/$slug 404s otherwise, and
  // listing them here would advertise soft-404s to crawlers.
  for (const row of listAllBlogRows()) {
    const meta = blog[row.slug]?.meta as Record<string, string | undefined> | undefined;
    entries.push({
      path: `/blog/${row.slug}`,
      lastmod: newest(meta?.["article:modified_time"], row.publishedAt),
    });
  }
  return entries;
}

export const SITEMAP_CHILDREN: ReadonlyArray<{
  group: SitemapGroup;
  /** Public path of the child sitemap. */
  path: string;
}> = [
  { group: "pages", path: "/sitemap-pages.xml" },
  { group: "industries", path: "/sitemap-industries.xml" },
  { group: "blog", path: "/sitemap-blog.xml" },
];

export function collectSitemapEntriesByGroup(group: SitemapGroup): SitemapEntry[] {
  if (group === "pages") return collectPageEntries();
  if (group === "industries") return collectIndustryEntries();
  return collectBlogEntries();
}

/** Every indexable URL across all child sitemaps. */
export function collectSitemapEntries(): SitemapEntry[] {
  return SITEMAP_CHILDREN.flatMap((c) => collectSitemapEntriesByGroup(c.group));
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildUrlsetXml(entries: SitemapEntry[]): string {
  const urls = entries.map((e) =>
    [
      "  <url>",
      `    <loc>${esc(`${BASE_URL}${e.path}`)}</loc>`,
      ...(e.lastmod ? [`    <lastmod>${e.lastmod}</lastmod>`] : []),
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

export function buildChildSitemapXml(group: SitemapGroup): string {
  return buildUrlsetXml(collectSitemapEntriesByGroup(group));
}

/** The /sitemap.xml index that points at the child sitemaps. */
export function buildSitemapXml(): string {
  const items = SITEMAP_CHILDREN.map((c) => {
    const dates = collectSitemapEntriesByGroup(c.group)
      .map((e) => e.lastmod)
      .filter((d): d is string => !!d)
      .sort();
    const last = dates.at(-1);
    return [
      "  <sitemap>",
      `    <loc>${BASE_URL}${c.path}</loc>`,
      ...(last ? [`    <lastmod>${last}</lastmod>`] : []),
      "  </sitemap>",
    ].join("\n");
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...items,
    `</sitemapindex>`,
  ].join("\n");
}

export const SITEMAP_CONTENT_TYPE = "application/xml; charset=utf-8" as const;
