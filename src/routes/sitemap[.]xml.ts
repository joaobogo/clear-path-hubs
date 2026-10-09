import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITEMAP_CONTENT_TYPE, buildSitemapXml } from "@/lib/seo/index-config";

// Sitemap index. Child sitemaps live at /sitemap-pages.xml, /sitemap-industries.xml
// and /sitemap-blog.xml. Generated at request time from `src/lib/seo/index-config.ts` — the same
// module that produces /robots.txt.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(buildSitemapXml(), {
          headers: {
            "Content-Type": SITEMAP_CONTENT_TYPE,
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
