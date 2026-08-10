import { createFileRoute } from "@tanstack/react-router";
import {
  PUBLIC_RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
} from "@/lib/public-api/rate-limit";

/**
 * Interview reminders (24h and 1h) plus no-show flagging. Called by the
 * scheduler with the project's publishable key in the `apikey` header. Safe to
 * run repeatedly — each reminder and each no-show is stamped once.
 */
export const Route = createFileRoute("/api/public/candidate/interview-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronDecision = consumeRateLimit("cron_invoke", clientIp(request), PUBLIC_RATE_LIMITS.cron_invoke);
        if (cronDecision.limited) return rateLimitResponse(newTraceId("cron_invoke"), cronDecision);

        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

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
