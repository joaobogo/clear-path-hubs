import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { buildRobotsTxt } from "@/lib/seo/index-config";

// Generated at request time from the same route/exclusion source as
// /sitemap.xml, so the two can never drift apart.
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(buildRobotsTxt(), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
