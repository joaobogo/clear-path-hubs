import type { ContentEntry } from "@/lib/marketing/content";

const CANONICAL_ORIGIN = "https://clear-path-hubs.lovable.app";

export function marketingHead(
  entry: ContentEntry | undefined,
  path: string,
  fallback?: { title: string; description: string },
) {
  const title =
    entry?.meta["og:title"] || entry?.meta.title || fallback?.title || "TaaSFlow";
  const description =
    entry?.meta["og:description"] ||
    entry?.meta.description ||
    fallback?.description ||
    "Subscription recruiting that delivers ranked, enriched candidates in 14 days.";
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
