import { CANONICAL_ORIGIN } from "@/lib/canonical-origin";
import type { ContentEntry } from "@/lib/marketing/content";

// Canonical production origin. Preview subdomains must not
// compete with the primary domain in search — its canonical URLs point
// here, and `<Root>` injects `noindex` at runtime when served from any
// other host. Single host: bare domain (matches robots.txt + sitemap).

/** Longest meta description search engines render without truncation. */
const MAX_DESCRIPTION = 158;

/**
 * Trim a description to the SERP-visible length on a word boundary.
 *
 * Content descriptions are authored for the page, not for the snippet, so a
 * few run long. Clamping here keeps every route inside the rendered length
 * without editing approved copy.
 */
export function clampDescription(text: string, max = MAX_DESCRIPTION): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("—"), cut.lastIndexOf(","));
  const base = (lastBreak > max * 0.6 ? cut.slice(0, lastBreak) : cut).replace(
    /[\s,;:—–-]+$/,
    "",
  );
  return `${base}…`;
}

/** Longest <title> Google renders in full on desktop and mobile SERPs. */
const MAX_TITLE = 59;

/**
 * Keep a page title inside the SERP-visible length without mangling the
 * headline.
 *
 * Content titles are authored as headlines, so many carry a subtitle after a
 * colon, dash or pipe. Dropping the trailing segment reads as a deliberate
 * title, which a mid-word ellipsis never does — so segment splitting is tried
 * first and word-boundary trimming is only the last resort. The page's own
 * <h1> comes from `meta.h1` and is untouched.
 */
export function clampTitle(text: string, max = MAX_TITLE): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  // Longest leading segment that still fits, e.g.
  // "Cost-Per-Hire Calculator: How to Find …" -> "Cost-Per-Hire Calculator".
  let best = "";
  for (const match of clean.matchAll(/\s*[:|–—]\s*/g)) {
    const head = clean.slice(0, match.index).trim();
    if (head.length <= max && head.length > best.length) best = head;
  }
  // Guard against a stub like "2026" winning over real words.
  if (best.length >= 20) return best;

  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(
    /[\s,;:|–—-]+$/,
    "",
  );
  return `${base}…`;
}



export type BreadcrumbItem = { name: string; path: string };

/**
 * BreadcrumbList JSON-LD for a nested page. Only describes links that exist
 * in the page's own navigation — no invented hierarchy.
 */
export function breadcrumbScript(items: BreadcrumbItem[]) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        item: `${CANONICAL_ORIGIN}${item.path}`,
      })),
    }),
  };
}

export function marketingHead(
  entry: ContentEntry | undefined,
  path: string,
  fallback?: { title: string; description: string },
  options?: { breadcrumbs?: BreadcrumbItem[] },
) {
  // Page-specific title/description always win. og:* is only a fallback so a
  // generic share string can never become the page <title>.
  const title = clampTitle(
    entry?.meta.title || entry?.meta["og:title"] || fallback?.title || "TaaSFlow",
  );
  const description = clampDescription(
    entry?.meta.description ||
      entry?.meta["og:description"] ||
      fallback?.description ||
      "AI Hiring Intelligence Platform — agents run the search, evidence backs every score, and ranked candidates land in a live Decision Workspace.",
  );
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
    ...(options?.breadcrumbs?.length
      ? { scripts: [breadcrumbScript(options.breadcrumbs)] }
      : {}),
  };
}
