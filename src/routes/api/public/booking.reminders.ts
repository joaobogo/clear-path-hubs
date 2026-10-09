/**
 * Retired: booking reminders were removed with scheduling. The route stays
 * registered (with its rate limit and cron-secret check) so an external
 * scheduler that still calls it gets a harmless 200. No side effects.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  PUBLIC_RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
} from "@/lib/public-api/rate-limit";
import { requireCronSecret } from "@/lib/public-api/cron-auth";

export const Route = createFileRoute("/api/public/booking/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronDecision = consumeRateLimit("cron_invoke", clientIp(request), PUBLIC_RATE_LIMITS.cron_invoke);
        if (cronDecision.limited) return rateLimitResponse(newTraceId("cron_invoke"), cronDecision);

        const denied = requireCronSecret(request);
        if (denied) return denied;

        return Response.json({ ok: true, disabled: true, reason: "scheduling removed" });
      },
    },
  },
});
