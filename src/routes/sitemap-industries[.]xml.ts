import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITEMAP_CONTENT_TYPE, buildChildSitemapXml } from "@/lib/seo/index-config";

// Child sitemap, generated at request time from `src/lib/seo/index-config.ts`.
export const Route = createFileRoute("/sitemap-industries.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(buildChildSitemapXml("industries"), {
          headers: {
            "Content-Type": SITEMAP_CONTENT_TYPE,
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
