/**
 * Canonical public origin for TaaSFlow.
 *
 * Everything user-facing (sign-in, share links, canonical URLs, structured
 * data, emails) must point at the real product domain — never at the Lovable
 * preview host. Preview builds stay browsable, but any link that is meant to
 * take a person to "TaaSFlow" leaves the preview and lands on the real domain.
 */
export const CANONICAL_ORIGIN = "https://www.taasflow.com";

/** Hosts that ARE the production site (no rewrite needed). */
const PRODUCTION_HOSTS = new Set(["www.taasflow.com", "taasflow.com"]);

export function isCanonicalHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

/** Absolute canonical URL for an app path. */
export function canonicalUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${CANONICAL_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Returns the href to use for a link that must always resolve on the real
 * TaaSFlow domain. On production (and during SSR) this stays a relative path
 * so client-side routing still works; on preview/local hosts it becomes an
 * absolute production URL.
 */
export function productionHref(path: string): string {
  if (typeof window === "undefined") return path;
  return isCanonicalHost(window.location.hostname) ? path : canonicalUrl(path);
}
