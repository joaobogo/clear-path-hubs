import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { listIndustrySlugs } from "@/lib/marketing/content";
import { listAllBlogRows } from "@/lib/marketing/blog-catalog";
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";
import { BLOG_CATEGORY_BY_SLUG } from "@/lib/marketing/blog-manifest";

// Canonical production origin. Keep in sync with `src/lib/marketing/head.ts`.
const BASE_URL = "https://taasflow.com";

// Intentional exclusions — nothing that emits `noindex` may appear below.
// - /login, /reset-password, /access-denied, /unauthorized: auth plumbing,
//   `noindex,follow`.
// - /admin/*, /client/*, /me/*, /boardroom, /checkout, /checkout/return,
//   /book-call: behind the authenticated route gate, `noindex` on the whole
//   subtree; a crawler can never reach them.
// - /brand-center, /dev/catalogue, /dev/industry-coverage: internal tooling,
//   `noindex` + disallowed in robots.txt.
// - /jobs/$id and /jobs/$id/apply: per-role pages carry `noindex` (roles open
//   and close constantly; /jobs is the indexable entry point).
// - /apply/status, /apply/received/$id, /intake/confirmation, /share/$token:
//   post-submission and tokenised pages, `noindex`.
// - /auth → /login (308), /pilot/intake → /intake (301),
//   /industries/non-profit → /industries/nonprofit (301), legacy short
//   industry slugs (301): redirects, so only the destination is listed.
const STATIC_PATHS = [
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
  "/system",
  "/trust",
  "/intake",
  "/talent-marketplace",
  "/candidate-join",
  "/candidate-success",
  "/pitch",
] as const;

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls: string[] = [];
        for (const p of STATIC_PATHS) {
          urls.push(entry(p, p === "/" ? "1.0" : "0.8"));
        }
        // Emit only canonical (public) industry slugs. Legacy short
        // slugs 301 to these at the route layer.
        const seenIndustry = new Set<string>();
        for (const slug of listIndustrySlugs()) {
          const publicSlug = toPublicSlug(slug);
          if (seenIndustry.has(publicSlug)) continue;
          seenIndustry.add(publicSlug);
          urls.push(entry(`/industries/${publicSlug}`, "0.7"));
        }
        // Briefing pages are public, indexable content hanging off each
        // canonical industry, with their own self-referencing canonical.
        for (const publicSlug of seenIndustry) {
          urls.push(entry(`/industries/${publicSlug}/briefing`, "0.6"));
        }
        // Blog category hubs are linked from /blog and indexable.
        for (const categorySlug of Object.keys(BLOG_CATEGORY_BY_SLUG)) {
          urls.push(entry(`/blog/category/${categorySlug}`, "0.5"));
        }
        // Only posts the blog actually publishes. A JSON file on disk is not
        // enough: /blog/$slug 404s for unpublished slugs, so listing them here
        // would advertise soft-404s to crawlers.
        for (const row of listAllBlogRows()) {
          urls.push(entry(`/blog/${row.slug}`, "0.6"));
        }
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

function entry(path: string, priority: string) {
  return [
    "  <url>",
    `    <loc>${BASE_URL}${path}</loc>`,
    "    <changefreq>weekly</changefreq>",
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}
