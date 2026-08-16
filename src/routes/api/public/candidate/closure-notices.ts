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
 * Closure notices for declined candidates. Called by the scheduler with the
 * server-only CRON_INVOKE_SECRET in the `x-cron-secret` header. Safe to run repeatedly —
 * each application is only ever notified once.
 */
export const Route = createFileRoute("/api/public/candidate/closure-notices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronDecision = consumeRateLimit("cron_invoke", clientIp(request), PUBLIC_RATE_LIMITS.cron_invoke);
        if (cronDecision.limited) return rateLimitResponse(newTraceId("cron_invoke"), cronDecision);

        const denied = requireCronSecret(request);
        if (denied) return denied;

        try {
          const { runClosureNotices } = await import("@/lib/candidate/closure-notices.server");
          const result = await runClosureNotices();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[closure-notices] failed", (err as Error)?.message);
          return new Response(JSON.stringify({ ok: false, error: "closure_notices_failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
