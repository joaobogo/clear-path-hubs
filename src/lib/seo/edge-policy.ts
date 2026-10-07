/**
 * Request-level SEO policy, kept free of framework imports so it can be unit
 * tested and reused by `src/start.ts` (middleware) and the root route (head).
 */
import { BOOKING_ROUTE, LEGACY_BOOKING_PATHS } from "@/config/booking";
import { isCanonicalHost } from "@/lib/canonical-origin";
import { isWorkspacePath } from "@/lib/tracking/pixels";

/**
 * Legacy booking URLs that redirect to the canonical booking page.
 *
 * `/book-call` is deliberately NOT redirected: it is the signed-in client's
 * booking page (`src/routes/_authenticated/book-call.tsx`), linked from the
 * client workspace. Redirecting it would break that page. It stays
 * disallowed in robots.txt and is noindex behind the auth gate.
 */
const AUTHENTICATED_BOOKING_PATHS = new Set(["/book-call"]);

export const REDIRECTED_LEGACY_BOOKING_PATHS: readonly string[] = LEGACY_BOOKING_PATHS.filter(
  (p) => !AUTHENTICATED_BOOKING_PATHS.has(p),
);

/** Target path when `pathname` is a retired booking URL, otherwise null. */
export function legacyBookingRedirectFor(pathname: string): string | null {
  const bare = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return REDIRECTED_LEGACY_BOOKING_PATHS.includes(bare.toLowerCase()) ? BOOKING_ROUTE : null;
}

/** The value sent on `X-Robots-Tag` and in the robots meta tag on preview hosts. */
export const NON_PRODUCTION_ROBOTS = "noindex, nofollow" as const;

/** True when this host may be indexed (production apex, `www`, local dev). */
export function isIndexableHost(host: string | null | undefined): boolean {
  if (!host) return true;
  // Strip port and any forwarded-host list ("a.com, b.com" -> first).
  const first = host.split(",")[0]!.trim().toLowerCase();
  const hostname = first.replace(/:\d+$/, "");
  return isCanonicalHost(hostname);
}

/**
 * Revalidate HTML on every request so a CDN or browser can never serve a
 * stale copy of a marketing page. Conditional requests still get a cheap 304
 * when the host supports ETags.
 */
export const HTML_CACHE_CONTROL = "public, max-age=0, must-revalidate" as const;

/**
 * The `Cache-Control` to add to a response, or null to leave it alone.
 * Never touches API/asset/webhook paths, workspace pages, redirects, responses
 * that already declare caching, or responses that set cookies.
 */
export function htmlCacheControlFor(input: {
  pathname: string;
  status: number;
  contentType: string | null;
  hasCacheControl: boolean;
  hasSetCookie: boolean;
}): string | null {
  const { pathname, status, contentType, hasCacheControl, hasSetCookie } = input;
  if (hasCacheControl || hasSetCookie) return null;
  if (status >= 300 && status < 400) return null;
  if (!contentType || !contentType.toLowerCase().startsWith("text/html")) return null;
  const lower = pathname.toLowerCase();
  if (/^\/(api|lovable|assets|_)(\/|$)/.test(lower) || lower.startsWith("/_")) return null;
  if (lower.startsWith("/share/") || lower.startsWith("/apply/")) return null;
  if (isWorkspacePath(pathname)) return null;
  return HTML_CACHE_CONTROL;
}
