import { CANONICAL_ORIGIN } from "@/lib/canonical-origin";
import type { ContentEntry } from "@/lib/marketing/content";

// Canonical production origin. Preview subdomains must not
// compete with the primary domain in search — its canonical URLs point
// here, and `<Root>` injects `noindex` at runtime when served from any
// other host. Single host: bare domain (matches robots.txt + sitemap).


export function marketingHead(
  entry: ContentEntry | undefined,
  path: string,
  fallback?: { title: string; description: string },
) {
  // Page-specific title/description always win. og:* is only a fallback so a
  // generic share string can never become the page <title>.
  const title =
    entry?.meta.title || entry?.meta["og:title"] || fallback?.title || "TaaSFlow";
  const description =
    entry?.meta.description ||
    entry?.meta["og:description"] ||
    fallback?.description ||
    "AI Hiring Intelligence Platform — agents run the search, evidence backs every score, and ranked candidates land in a live Decision Workspace.";
  const url = `${CANONICAL_ORIGIN}${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: entry?.meta["og:type"] || "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
