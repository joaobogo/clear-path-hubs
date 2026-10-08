import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { legacyRedirectTarget } from "@/config/legacy-redirects";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import {
  NON_PRODUCTION_ROBOTS,
  htmlCacheControlFor,
  isIndexableHost,
  legacyBookingRedirectFor,
} from "@/lib/seo/edge-policy";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  // Lovable email/webhook routes authenticate themselves — never intercept them.
  if (new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * TF-006: one canonical host. `taasflow.com` (apex) is the canonical origin
 * used by robots.txt, the sitemap, canonical tags and og:url, so any `www.`
 * host permanently redirects to it instead of serving a duplicate copy.
 * Path, query and hash are preserved; non-GET methods get 308 so the method
 * and body survive the redirect.
 */
const canonicalHostMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  if (host.startsWith("www.") && host.endsWith("taasflow.com")) {
    url.hostname = host.slice(4);
    const status = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
    return new Response(null, {
      status,
      headers: { location: url.toString(), "cache-control": "public, max-age=3600" },
    });
  }
  return next();
});

/**
 * Retired booking URLs (/book, /book-call, /book-a-call, /schedule, /demo) 301
 * to /contact. See `src/lib/seo/edge-policy.ts`.
 */
const legacyBookingMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const target = legacyBookingRedirectFor(url.pathname);
  if (target) {
    url.pathname = target;
    const status = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
    return new Response(null, {
      status,
      headers: { location: url.toString(), "cache-control": "public, max-age=3600" },
    });
  }
  return next();
});

/**
 * Merged pages (/platform, /system, /employer-onboarding, /trust, /journey)
 * 301 to the page and section that now carries their content. The table lives
 * in `src/config/legacy-redirects.ts`; the query string is kept.
 */
const legacyPageMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const target = legacyRedirectTarget(url.pathname);
  if (target) {
    const [path, hash] = target.split("#");
    url.pathname = path!;
    url.hash = hash ? `#${hash}` : "";
    const status = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
    return new Response(null, {
      status,
      headers: { location: url.toString(), "cache-control": "public, max-age=3600" },
    });
  }
  return next();
});

/**
 * One canonical CASE for a path, for the same reason there is one canonical
 * host.
 *
 * `/PRICING` served a 200 with the pricing page and a canonical tag pointing
 * at `/pricing`. The tag keeps the duplicate out of the index, but every link,
 * share and analytics hit against the variant lands on its own URL and the
 * signal splits (audit 18 Sep, TF-C-029).
 *
 * Deliberately NOT a blanket lowercase. These paths carry values where case is
 * meaningful, or is not ours to change:
 *
 *   /share/    — an opaque share token. Lowercasing it breaks the link.
 *   /apply/    — carries application ids in receipt URLs.
 *   /lovable/  — Lovable's own routes; never intercepted anywhere in this file.
 *   /api/      — callers send what they send.
 *   /assets/, /_  — build output, case-sensitive on disk.
 *   anything with a file extension — same reason.
 *
 * Everything else in this app is lowercase by construction: blog, industries
 * and resources slugs are generated lowercase, and Postgres renders uuids
 * lowercase, so an uppercase variant of those is a hand-typed URL rather than
 * one we ever emitted.
 */
const CASE_SENSITIVE_PREFIXES = ["/share/", "/apply/", "/lovable/", "/api/", "/assets/", "/_"];

export function canonicalPathFor(pathname: string): string | null {
  const lower = pathname.toLowerCase();
  if (lower === pathname) return null;
  if (CASE_SENSITIVE_PREFIXES.some((p) => lower.startsWith(p))) return null;
  // A file extension means a static asset, and those are case-sensitive.
  if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return null;
  return lower;
}

const canonicalPathMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const canonical = canonicalPathFor(url.pathname);
  if (canonical) {
    url.pathname = canonical;
    const status = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
    return new Response(null, {
      status,
      headers: { location: url.toString(), "cache-control": "public, max-age=3600" },
    });
  }
  return next();
});

/**
 * Clickjacking defence. /admin and /client carry one-click controls, so no
 * origin may frame this app.
 *
 * The CSP here is deliberately narrow: `frame-ancestors 'none'` only. A full
 * `default-src`/`script-src` policy is NOT shipped yet because the app loads
 * third-party tag managers, pixels and Google Fonts at runtime (see
 * src/lib/tracking/pixels.ts) and several of those inject further scripts of
 * their own; shipping an unverified allow-list would silently break fonts,
 * consent-gated tracking or Supabase calls. `frame-ancestors` cannot be set
 * from a meta tag, needs no allow-list, and cannot break a same-origin load.
 */
const SECURITY_HEADERS: Array<[string, string]> = [
  ["content-security-policy", "frame-ancestors 'none'"],
  ["x-frame-options", "DENY"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=()"],
];

const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  // Lovable's own email/webhook routes are not browsed; leave them untouched.
  if (new URL(request.url).pathname.startsWith("/lovable/")) return result;
  const holder = result as unknown as { response?: Response };
  const response =
    holder && typeof holder === "object" && holder.response instanceof Response
      ? holder.response
      : (result as unknown as Response);
  if (!(response instanceof Response)) return result;
  const url = new URL(request.url);
  const extra: Array<[string, string]> = [...SECURITY_HEADERS];
  // Preview and other non-production hosts must never compete with the
  // canonical domain in search. Canonical tags still point at taasflow.com.
  const host = request.headers.get("host") ?? url.host;
  if (!isIndexableHost(host)) extra.push(["x-robots-tag", NON_PRODUCTION_ROBOTS]);
  // HTML must revalidate so a CDN cannot serve a stale copy of a public page.
  const cacheControl = htmlCacheControlFor({
    pathname: url.pathname,
    status: response.status,
    contentType: response.headers.get("content-type"),
    hasCacheControl: response.headers.has("cache-control"),
    hasSetCookie: response.headers.has("set-cookie"),
  });
  if (cacheControl) extra.push(["cache-control", cacheControl]);
  try {
    for (const [name, value] of extra) response.headers.set(name, value);
    return result;
  } catch {
    // Immutable headers (some runtimes) — rebuild the response instead.
    const headers = new Headers(response.headers);
    for (const [name, value] of extra) headers.set(name, value);
    const rebuilt = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    if (holder && typeof holder === "object" && holder.response instanceof Response) {
      holder.response = rebuilt;
      return result;
    }
    return rebuilt as unknown as typeof result;
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [
    canonicalHostMiddleware,
    legacyBookingMiddleware,
    legacyPageMiddleware,
    canonicalPathMiddleware,
    securityHeadersMiddleware,
    errorMiddleware,
  ],
}));
