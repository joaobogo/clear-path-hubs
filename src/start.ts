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
 * TF-006: one canonical host. taasflow.com is the canonical origin used by
 * robots.txt, the sitemap, canonical tags and og:url — so the www host
 * permanently redirects to it instead of serving a duplicate copy.
 */
const canonicalHostMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() === "www.taasflow.com") {
    url.hostname = "taasflow.com";
    return new Response(null, {
      status: 301,
      headers: { location: url.toString(), "cache-control": "public, max-age=3600" },
    });
  }
  return next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [canonicalHostMiddleware, errorMiddleware],
}));
