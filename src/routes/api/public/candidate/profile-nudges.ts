import { createFileRoute } from "@tanstack/react-router";
import {
  PUBLIC_RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
} from "@/lib/public-api/rate-limit";
import { requireCronSecret } from "@/lib/public-api/cron-auth";

/**
 * Bounded profile-completion nudges (max two per candidate, ever). Called by the
 * scheduler with the server-only CRON_INVOKE_SECRET in the `x-cron-secret` header.
 */
export const Route = createFileRoute("/api/public/candidate/profile-nudges")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronDecision = consumeRateLimit("cron_invoke", clientIp(request), PUBLIC_RATE_LIMITS.cron_invoke);
        if (cronDecision.limited) return rateLimitResponse(newTraceId("cron_invoke"), cronDecision);

        const denied = requireCronSecret(request);
        if (denied) return denied;

        try {
          const { runProfileNudges } = await import("@/lib/candidate/profile-nudges.server");
          const result = await runProfileNudges();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[profile-nudges] failed", (err as Error)?.message);
          return new Response(JSON.stringify({ ok: false, error: "profile_nudges_failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
