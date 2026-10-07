import { CANONICAL_ORIGIN } from "@/lib/canonical-origin";
import type { ContentEntry } from "@/lib/marketing/content";
import { BRAND_ONE_LINER, PRODUCT_CATEGORY } from "@/config/product-language";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import { PILOT_SUMMARY } from "@/config/offer-facts";

/**
 * Branded 1200x630 share card, served from the canonical domain. Every route
 * falls back to this so no page can inherit a preview-host image from the
 * platform's automatic screenshot.
 */
export const DEFAULT_SHARE_IMAGE = "/og-image.png";

// Canonical production origin. Preview subdomains must not compete with the
// primary domain in search: canonical URLs and og:url always point at
// CANONICAL_ORIGIN, while `__root.tsx` adds `robots: noindex, nofollow` to the
// served HTML and `src/start.ts` sends `X-Robots-Tag` on any non-production
// host (see `src/lib/seo/edge-policy.ts`). Single host: bare domain (matches
// robots.txt + sitemap).
//
// Metadata precedence: a content entry's own `meta.title`/`meta.description`
// always wins; `meta["og:title"]`/`["og:description"]` come next; a route's
// `fallback` is used only when the entry says nothing; the brand one-liner is
// the last resort.

/** Longest meta description search engines render without truncation. */
const MAX_DESCRIPTION = 158;

/** Warn thresholds used by the audit test and by dev-time warnings. */
export const TITLE_WARN_LENGTH = 60;
export const DESCRIPTION_WARN_LENGTH = 160;

export type ClampResult = {
  text: string;
  /** True when the clamp removed any words from the authored text. */
  clamped: boolean;
  /** The authored text, whitespace-normalised, before clamping. */
  original: string;
};

/** A human-readable warning for each field that had to be shortened. */
export function lengthWarnings(
  result: { title: ClampResult; description: ClampResult },
  path: string,
): string[] {
  const out: string[] = [];
  if (result.title.clamped) {
    out.push(
      `[head] ${path}: title is ${result.title.original.length} characters and was shortened to "${result.title.text}". Original: "${result.title.original}". Shorten the authored title so no qualifier is dropped.`,
    );
  }
  if (result.description.clamped) {
    out.push(
      `[head] ${path}: description is ${result.description.original.length} characters and was shortened. Shorten the authored description so no qualifier is dropped.`,
    );
  }
  return out;
}

const warnedPaths = new Set<string>();

/** Dev and test only; never throws and never runs in production builds. */
function warnOnce(path: string, messages: string[]) {
  if (messages.length === 0 || warnedPaths.has(path)) return;
  const env = (import.meta as unknown as { env?: { DEV?: boolean; MODE?: string } }).env;
  if (!env?.DEV && env?.MODE !== "test") return;
  warnedPaths.add(path);
  for (const m of messages) console.warn(m);
}

/**
 * Trim a description to the SERP-visible length on a word boundary.
 *
 * Content descriptions are authored for the page, not for the snippet, so a
 * few run long. Clamping here keeps every route inside the rendered length
 * without editing approved copy.
 */
export function clampDescription(text: string, max = MAX_DESCRIPTION): string {
  return clampDescriptionDetailed(text, max).text;
}

/** Same clamp as `clampDescription`, but reports whether it removed anything. */
export function clampDescriptionDetailed(text: string, max = MAX_DESCRIPTION): ClampResult {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return { text: clean, clamped: false, original: clean };
  const cut = clean.slice(0, max - 1);
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("—"), cut.lastIndexOf(","));
  const base = (lastBreak > max * 0.6 ? cut.slice(0, lastBreak) : cut).replace(
    /[\s,;:—–-]+$/,
    "",
  );
  return { text: `${base}…`, clamped: true, original: clean };
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
  return clampTitleDetailed(text, max).text;
}

/** Same clamp as `clampTitle`, but reports whether it removed anything. */
export function clampTitleDetailed(text: string, max = MAX_TITLE): ClampResult {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return { text: clean, clamped: false, original: clean };

  // Longest leading segment that still fits, e.g.
  // "Cost-Per-Hire Calculator: How to Find …" -> "Cost-Per-Hire Calculator".
  let best = "";
  for (const match of clean.matchAll(/\s*[:|–—]\s*/g)) {
    const head = clean.slice(0, match.index).trim();
    if (head.length <= max && head.length > best.length) best = head;
  }
  // Guard against a stub like "2026" winning over real words.
  if (best.length >= 16) return { text: best, clamped: true, original: clean };

  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(
    /[\s,;:|–—-]+$/,
    "",
  );
  return { text: `${base}…`, clamped: true, original: clean };
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
  // The only price published in structured data is the one-time pilot, from
  // pricing-core. Package totals and per-position prices are never emitted.
  const offers =
    input.path === "/pricing"
      ? {
          offers: {
            "@type": "Offer",
            name: "TaaSFlow pilot",
            description: PILOT_SUMMARY,
            price: String(PRICE_PILOT_USD),
            priceCurrency: "USD",
            url: `${CANONICAL_ORIGIN}/pilot`,
          },
        }
      : {};
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Service",
      name: input.name,
      description: input.description,
      url: `${CANONICAL_ORIGIN}${input.path}`,
      ...(input.serviceType ? { serviceType: input.serviceType } : {}),
      ...offers,
      provider: { "@id": "https://taasflow.com/#organization" },
    }),
  };
}

/**
 * WebApplication JSON-LD. Emitted only on /platform (by `marketingHead`), the
 * page that describes the software, never sitewide.
 */
export function webApplicationScript() {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${CANONICAL_ORIGIN}/platform/#software`,
      name: "TaaSFlow",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: PRODUCT_CATEGORY,
      operatingSystem: "Web",
      url: `${CANONICAL_ORIGIN}/platform`,
      description: `${BRAND_ONE_LINER} Intake Engine, Blueprint Compiler, Agent Layer, Evidence Graph, Scoring Engine and Decision Workspace in one governed system.`,
      publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
    }),
  };
}

/**
 * Article JSON-LD for one blog post. Only fields the post actually declares
 * are emitted — a missing date or cover is omitted, never invented.
 */
export function articleScript(input: {
  headline: string;
  description?: string;
  path: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  articleSection?: string;
  keywords?: readonly string[];
  author: { name: string; type: "Person" | "Organization"; url?: string };
}) {
  const image = absoluteShareImage(input.image);
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: input.headline,
      ...(input.description ? { description: input.description } : {}),
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${CANONICAL_ORIGIN}${input.path}`,
      },
      url: `${CANONICAL_ORIGIN}${input.path}`,
      ...(image ? { image: [image] } : {}),
      ...(input.articleSection ? { articleSection: input.articleSection } : {}),
      ...(input.keywords?.length ? { keywords: input.keywords.join(", ") } : {}),
      ...(input.datePublished ? { datePublished: input.datePublished } : {}),
      ...(input.dateModified ? { dateModified: input.dateModified } : {}),
      author: {
        "@type": input.author.type,
        name: input.author.name,
        ...(input.author.url
          ? {
              url: input.author.url.startsWith("http")
                ? input.author.url
                : `${CANONICAL_ORIGIN}${input.author.url}`,
            }
          : {}),
      },
      publisher: { "@id": "https://taasflow.com/#organization" },
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
    /** Robots directive for this page, e.g. "noindex, follow". Omit for indexable pages. */
    robots?: string;
    /** Archive pagination: emitted as rel=prev / rel=next. */
    prevPath?: string;
    nextPath?: string;
  },
) {
  // Page-specific title/description always win. og:* is only a fallback so a
  // generic share string can never become the page <title>.
  const titleResult = clampTitleDetailed(
    entry?.meta.title || entry?.meta["og:title"] || fallback?.title || "TaaSFlow",
  );
  const descriptionResult = clampDescriptionDetailed(
    entry?.meta.description ||
      entry?.meta["og:description"] ||
      fallback?.description ||
      BRAND_ONE_LINER,
  );
  warnOnce(path, lengthWarnings({ title: titleResult, description: descriptionResult }, path));
  const title = titleResult.text;
  const description = descriptionResult.text;
  const url = `${CANONICAL_ORIGIN}${path}`;
  // The page's own hero/cover wins; otherwise the branded card on this domain.
  // Never a preview-host URL, and never an empty share preview.
  const image =
    absoluteShareImage(options?.image) ?? absoluteShareImage(DEFAULT_SHARE_IMAGE);
  const scripts = [
    ...(options?.breadcrumbs?.length ? [breadcrumbScript(options.breadcrumbs)] : []),
    ...(path === "/platform" ? [webApplicationScript()] : []),
    ...(options?.scripts ?? []),
  ];
  return {
    meta: [
      { title },
      { name: "description", content: description },
      ...(options?.robots ? [{ name: "robots", content: options.robots }] : []),
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: entry?.meta["og:type"] || "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(image
        ? [
            { property: "og:image", content: image },
            { name: "twitter:image", content: image },
          ]
        : []),
    ],

    links: [
      { rel: "canonical", href: url },
      ...(options?.prevPath
        ? [{ rel: "prev", href: `${CANONICAL_ORIGIN}${options.prevPath}` }]
        : []),
      ...(options?.nextPath
        ? [{ rel: "next", href: `${CANONICAL_ORIGIN}${options.nextPath}` }]
        : []),
    ],
    ...(scripts.length ? { scripts } : {}),
  };
}

