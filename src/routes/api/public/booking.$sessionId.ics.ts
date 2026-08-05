/**
 * Add-to-calendar file for a booking.
 *
 * Public by design (the booker isn't signed in) and deliberately thin: it only
 * ever returns the meeting time and title for one session id, never the
 * qualification answers, phone number, or any other stored field.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const paramsSchema = z.object({ sessionId: z.string().uuid() });

/** RFC 5545 wants UTC stamps as YYYYMMDDTHHMMSSZ. */
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapes the characters ICS treats as structure. */
function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export const Route = createFileRoute("/api/public/booking/$sessionId/ics")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = paramsSchema.safeParse(params);
        if (!parsed.success) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("booking_sessions")
          .select("id, status, scheduled_start, scheduled_end, host_name, host_email, join_url")
          .eq("id", parsed.data.sessionId)
          .maybeSingle();

        if (!data || data.status === "cancelled" || !data.scheduled_start || !data.scheduled_end) {
          return new Response("Not found", { status: 404 });
        }

        const host = data.host_name ?? "TaaSFlow";
        const description = data.join_url
          ? `Join the call: ${data.join_url}`
          : "We'll send the meeting link before the call.";

        const lines = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//TaaSFlow//Booking//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          "BEGIN:VEVENT",
          `UID:booking-${data.id}@taasflow.com`,
          `DTSTAMP:${icsStamp(new Date().toISOString())}`,
          `DTSTART:${icsStamp(data.scheduled_start)}`,
          `DTEND:${icsStamp(data.scheduled_end)}`,
          `SUMMARY:${esc(`Hiring call with ${host}`)}`,
          `DESCRIPTION:${esc(description)}`,
          ...(data.join_url ? [`URL:${esc(data.join_url)}`] : []),
          ...(data.host_email ? [`ORGANIZER;CN=${esc(host)}:mailto:${esc(data.host_email)}`] : []),
          "STATUS:CONFIRMED",
          "BEGIN:VALARM",
          "TRIGGER:-PT15M",
          "ACTION:DISPLAY",
          "DESCRIPTION:Hiring call in 15 minutes",
          "END:VALARM",
          "END:VEVENT",
          "END:VCALENDAR",
        ];

        return new Response(`${lines.join("\r\n")}\r\n`, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="taasflow-call.ics"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
