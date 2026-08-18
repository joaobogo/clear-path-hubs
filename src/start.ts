import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

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
  try {
    for (const [name, value] of SECURITY_HEADERS) response.headers.set(name, value);
    return result;
  } catch {
    // Immutable headers (some runtimes) — rebuild the response instead.
    const headers = new Headers(response.headers);
    for (const [name, value] of SECURITY_HEADERS) headers.set(name, value);
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
  requestMiddleware: [canonicalHostMiddleware, securityHeadersMiddleware, errorMiddleware],
}));
