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
 * Weekly client digest trigger. Called by the scheduler (pg_cron) with the
 * server-only CRON_INVOKE_SECRET in the `x-cron-secret` header.
 */
export const Route = createFileRoute("/api/public/digest/weekly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronDecision = consumeRateLimit("cron_invoke", clientIp(request), PUBLIC_RATE_LIMITS.cron_invoke);
        if (cronDecision.limited) return rateLimitResponse(newTraceId("cron_invoke"), cronDecision);

        const denied = requireCronSecret(request);
        if (denied) return denied;

        try {
          const { runWeeklyDigest } = await import("@/lib/digest/weekly-digest.server");
          const result = await runWeeklyDigest();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[digest/weekly] failed", (err as Error)?.message);
          return new Response(JSON.stringify({ ok: false, error: "digest_failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
