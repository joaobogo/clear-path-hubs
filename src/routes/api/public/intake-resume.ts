import { createFileRoute } from "@tanstack/react-router";
import {
  draftCookieHeader,
  hashToken,
  isWellFormedToken,
} from "@/routes/api/public/intake-draft";
import {
  PUBLIC_RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
} from "@/lib/public-api/rate-limit";

/**
 * Resume link from the email. It re-establishes the httpOnly draft cookie on
 * whatever device opened the link, then hands the client back to the form.
 */
export const Route = createFileRoute("/api/public/intake-resume")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const decision = consumeRateLimit("intake_draft", clientIp(request), PUBLIC_RATE_LIMITS.intake_draft);
        if (decision.limited) return rateLimitResponse(newTraceId("intake_draft"), decision);

        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!isWellFormedToken(token)) {
          return Response.redirect(`${url.origin}/intake?draft=invalid`, 302);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("anonymous_intake_drafts")
          .select("submitted_at, expires_at")
          .eq("token_hash", hashToken(token!))
          .maybeSingle();

        if (!data) return Response.redirect(`${url.origin}/intake?draft=missing`, 302);
        if (data.submitted_at) {
          return Response.redirect(`${url.origin}/intake?draft=submitted`, 302);
        }
        if (new Date(data.expires_at).getTime() < Date.now()) {
          return Response.redirect(`${url.origin}/intake?draft=expired`, 302);
        }

        return new Response(null, {
          status: 302,
          headers: {
            location: `${url.origin}/intake?draft=resumed`,
            "cache-control": "no-store",
            "set-cookie": draftCookieHeader(token!, url.protocol === "https:"),
          },
        });
      },
    },
  },
});
