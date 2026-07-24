import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { listBlogSlugs, listIndustrySlugs } from "@/lib/marketing/content";
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";

// Canonical production origin. Keep in sync with `src/lib/marketing/head.ts`.
const BASE_URL = "https://taasflow.com";

// Intentional exclusions:
// - /login, /reset-password, /access-denied, /unauthorized, /admin/*, /_authenticated/*
//   are gated or private and carry `noindex,follow`.
// - /auth 308 → /login (no need to advertise the redirect target twice).
// - /jobs/$id/apply is per-role and `noindex`.
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
        for (const slug of listBlogSlugs()) {
          urls.push(entry(`/blog/${slug}`, "0.6"));
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
