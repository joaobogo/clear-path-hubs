/**
 * Reminder drain for booked calls — called on a schedule, never by a browser.
 *
 * Sends one reminder per booking in the next REMINDER_WINDOW, then stamps
 * reminder_sent_at so a re-run can't email anyone twice. Lives under
 * /api/public/* because pg_cron calls it from outside the session, and is
 * therefore locked to the project's anon key.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  PUBLIC_RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
} from "@/lib/public-api/rate-limit";

/** How far ahead we look for calls that still need a reminder. */
const REMINDER_WINDOW_MINUTES = 24 * 60;

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/booking/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronDecision = consumeRateLimit("cron_invoke", clientIp(request), PUBLIC_RATE_LIMITS.cron_invoke);
        if (cronDecision.limited) return rateLimitResponse(newTraceId("cron_invoke"), cronDecision);

        // The caller must present the project's publishable key.
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || provided !== expected) return unauthorized();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendBookingLifecycleEmail } = await import("@/lib/notification-email.server");
        const { fullLabel } = await import("@/lib/booking/slots");

        const now = new Date();
        const until = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60_000).toISOString();

        const { data, error } = await supabaseAdmin
          .from("booking_sessions")
          .select("id, email, first_name, scheduled_start, scheduled_end, timezone, host_name, join_url")
          .eq("status", "scheduled")
          .is("reminder_sent_at", null)
          .gt("scheduled_start", now.toISOString())
          .lt("scheduled_start", until)
          .limit(100);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let sent = 0;
        for (const row of data ?? []) {
          if (!row.scheduled_start || !row.scheduled_end) continue;
          try {
            await sendBookingLifecycleEmail({
              to: row.email,
              firstName: row.first_name,
              kind: "reminder",
              when: fullLabel(row.scheduled_start, row.scheduled_end, row.timezone ?? "UTC"),
              sessionId: row.id,
              joinUrl: row.join_url,
              hostName: row.host_name ?? "TaaSFlow",
            });
            // Stamp only after a successful send, so a provider outage retries.
            await supabaseAdmin
              .from("booking_sessions")
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq("id", row.id);
            sent += 1;
          } catch (err) {
            console.error("[booking] reminder failed", row.id, err);
          }
        }

        return new Response(JSON.stringify({ ok: true, considered: data?.length ?? 0, sent }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
