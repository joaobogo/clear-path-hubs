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
 * Interview reminders (24h and 1h) plus no-show flagging. Called by the
 * scheduler with the server-only CRON_INVOKE_SECRET in the `x-cron-secret` header. Safe to
 * run repeatedly — each reminder and each no-show is stamped once.
 */
export const Route = createFileRoute("/api/public/candidate/interview-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronDecision = consumeRateLimit("cron_invoke", clientIp(request), PUBLIC_RATE_LIMITS.cron_invoke);
        if (cronDecision.limited) return rateLimitResponse(newTraceId("cron_invoke"), cronDecision);

        const denied = requireCronSecret(request);
        if (denied) return denied;

        try {
          const { runInterviewReminders } = await import(
            "@/lib/candidate/interview-reminders.server"
          );
          const result = await runInterviewReminders();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[interview-reminders] failed", (err as Error)?.message);
          return new Response(
            JSON.stringify({ ok: false, error: "interview_reminders_failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
