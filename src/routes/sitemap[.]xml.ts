import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { listBlogSlugs, listIndustrySlugs } from "@/lib/marketing/content";

const BASE_URL = "https://clear-path-hubs.lovable.app";

const STATIC_PATHS = [
  "/",
  "/how-it-works",
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
  "/industries",
  "/blog",
  "/jobs",
  "/auth",
] as const;

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls: string[] = [];
        for (const p of STATIC_PATHS) {
          urls.push(entry(p, p === "/" ? "1.0" : "0.8"));
        }
        for (const slug of listIndustrySlugs()) {
          urls.push(entry(`/industries/${slug}`, "0.7"));
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
