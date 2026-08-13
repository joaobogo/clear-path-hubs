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
  if (best.length >= 16) return best;

  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(
    /[\s,;:|–—-]+$/,
    "",
  );
  return `${base}…`;
}
/**
 * Absolute https URL for a share image.
 *
 * Social crawlers never resolve relative paths, and bundled hero assets are
 * emitted as root-relative paths (`/assets/…`). Anything that isn't a real
 * https URL after prefixing is dropped rather than shared as a broken preview.
 */
export function absoluteShareImage(src: string | undefined): string | undefined {
  if (!src) return undefined;
  const url = src.startsWith("http")
    ? src
    : `${CANONICAL_ORIGIN}${src.startsWith("/") ? src : `/${src}`}`;
  return url.startsWith("https://") ? url : undefined;
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

/**
 * FAQPage JSON-LD. Only ever built from Q&As that are visible on the page —
 * the caller passes the same array it renders.
 */
export function faqScript(items: { q: string; a: string }[]) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    }),
  };
}

/**
 * Service JSON-LD for a page describing one concrete offer. Fields the site
 * does not state (price, area served specifics) are omitted, never guessed.
 */
export function serviceScript(input: {
  name: string;
  description: string;
  path: string;
  serviceType?: string;
}) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Service",
      name: input.name,
      description: input.description,
      url: `${CANONICAL_ORIGIN}${input.path}`,
      ...(input.serviceType ? { serviceType: input.serviceType } : {}),
      provider: { "@id": "https://taasflow.com/#organization" },
    }),
  };
}

export function marketingHead(
  entry: ContentEntry | undefined,
  path: string,
  fallback?: { title: string; description: string },
  options?: {
    breadcrumbs?: BreadcrumbItem[];
    image?: string;
    /** Extra JSON-LD blocks (Service, FAQPage, …) for this page only. */
    scripts?: { type: string; children: string }[];
  },
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
  // Only the page's own hero/cover becomes its share image; no placeholder.
  const image = absoluteShareImage(options?.image);
  const scripts = [
    ...(options?.breadcrumbs?.length ? [breadcrumbScript(options.breadcrumbs)] : []),
    ...(options?.scripts ?? []),
  ];
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: entry?.meta["og:type"] || "website" },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(image
        ? [
            { property: "og:image", content: image },
            { name: "twitter:image", content: image },
          ]
        : []),
    ],

    links: [{ rel: "canonical", href: url }],
    ...(scripts.length ? { scripts } : {}),
  };
}

