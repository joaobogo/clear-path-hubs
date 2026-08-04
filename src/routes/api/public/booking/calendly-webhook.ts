/**
 * Calendly webhook — the authority for meeting facts.
 *
 * Public route (external caller), so it must secure itself:
 *  - HMAC-SHA256 signature over the raw body, timing-safe compare
 *  - replay window on the signature timestamp
 *  - idempotency on the event id, so retries never double-apply
 *
 * Configure the signing key as CALENDLY_WEBHOOK_SIGNING_KEY.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const MAX_SKEW_SECONDS = 300;

const payloadSchema = z.object({
  event: z.string().max(120),
  created_at: z.string().max(60).optional(),
  payload: z
    .object({
      email: z.string().max(255).optional().nullable(),
      uri: z.string().max(500).optional().nullable(),
      reschedule_url: z.string().max(1000).optional().nullable(),
      cancel_url: z.string().max(1000).optional().nullable(),
      timezone: z.string().max(120).optional().nullable(),
      rescheduled: z.boolean().optional(),
      tracking: z
        .object({ utm_content: z.string().max(500).optional().nullable() })
        .partial()
        .optional()
        .nullable(),
      questions_and_answers: z
        .array(
          z.object({
            question: z.string().max(500).optional().nullable(),
            answer: z.string().max(2000).optional().nullable(),
          }),
        )
        .optional()
        .nullable(),
      scheduled_event: z
        .object({
          uri: z.string().max(500).optional().nullable(),
          start_time: z.string().max(60).optional().nullable(),
          end_time: z.string().max(60).optional().nullable(),
          location: z
            .object({ join_url: z.string().max(1000).optional().nullable() })
            .partial()
            .optional()
            .nullable(),
          event_memberships: z
            .array(
              z.object({
                user_name: z.string().max(200).optional().nullable(),
                user_email: z.string().max(255).optional().nullable(),
              }),
            )
            .optional()
            .nullable(),
        })
        .partial()
        .optional()
        .nullable(),
    })
    .partial(),
});

/** Parses `t=...,v1=...` and verifies the HMAC over `t.body`. */
function verifySignature(header: string | null, body: string, key: string): boolean {
  if (!header) return false;
  const parts = new Map<string, string>();
  for (const chunk of header.split(",")) {
    const [k, v] = chunk.split("=");
    if (k && v) parts.set(k.trim(), v.trim());
  }
  const timestamp = parts.get("t");
  const provided = parts.get("v1");
  if (!timestamp || !provided) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_SKEW_SECONDS) return false;

  const expected = createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The booking session id we passed through as utm_content, if present. */
function sessionIdFrom(parsed: z.infer<typeof payloadSchema>): string | null {
  const utm = parsed.payload.tracking?.utm_content ?? null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (utm && uuid.test(utm.trim())) return utm.trim();
  const answer = parsed.payload.questions_and_answers?.find((qa) =>
    uuid.test((qa.answer ?? "").trim()),
  );
  return answer?.answer?.trim() ?? null;
}

export const Route = createFileRoute("/api/public/booking/calendly-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signingKey = process.env["CALENDLY_WEBHOOK_SIGNING_KEY"];
        const raw = await request.text();

        if (!signingKey) {
          console.error("calendly webhook received but no signing key is configured");
          return new Response("Not configured", { status: 503 });
        }
        if (!verifySignature(request.headers.get("calendly-webhook-signature"), raw, signingKey)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const parsedJson = payloadSchema.safeParse(JSON.parse(raw) as unknown);
        if (!parsedJson.success) return new Response("Invalid payload", { status: 400 });
        const body = parsedJson.data;

        const {
          findBookingSession,
          applyBookingStatus,
          syncBookingStatusToCrm,
          recordWebhookEvent,
        } = await import("@/lib/booking/booking.server");

        const event = body.payload.scheduled_event ?? {};
        const inviteeUri = body.payload.uri ?? null;
        const eventUri = event.uri ?? null;
        const sessionId = sessionIdFrom(body);

        const row = await findBookingSession({
          sessionId,
          calendlyEventUri: eventUri,
          calendlyInviteeUri: inviteeUri,
          email: body.payload.email ?? null,
        });

        // Idempotency key: Calendly does not send a delivery id in the body, so
        // we derive a stable one from the event type + invitee/event URI.
        const fresh = await recordWebhookEvent({
          id: `${body.event}:${inviteeUri ?? eventUri ?? body.created_at ?? raw.length}`.slice(0, 200),
          eventType: body.event,
          sessionId: row?.id ?? null,
          payload: body,
        });
        if (!fresh) return new Response("Already processed", { status: 200 });

        if (!row) {
          // Someone booked outside our flow. Recorded above; nothing to update.
          console.warn("calendly webhook without matching booking session", { event: body.event });
          return new Response("No matching session", { status: 200 });
        }

        const host = event.event_memberships?.[0];
        const update =
          body.event === "invitee.canceled"
            ? { status: "cancelled" as const }
            : {
                status: (body.payload.rescheduled ? "rescheduled" : "scheduled") as
                  | "scheduled"
                  | "rescheduled",
                calendlyEventUri: eventUri,
                calendlyInviteeUri: inviteeUri,
                scheduledStart: event.start_time ?? null,
                scheduledEnd: event.end_time ?? null,
                timezone: body.payload.timezone ?? null,
                hostName: host?.user_name ?? null,
                hostEmail: host?.user_email ?? null,
                joinUrl: event.location?.join_url ?? null,
                rescheduleUrl: body.payload.reschedule_url ?? null,
                cancelUrl: body.payload.cancel_url ?? null,
              };

        const updated = await applyBookingStatus(row.id, update);
        if (updated) await syncBookingStatusToCrm(updated, update);

        // Booked, rescheduled or cancelled meetings are lead-grade facts: notify
        // Teams + internal email with a traceable delivery record.
        try {
          const { processLeadEvent } = await import("@/lib/leads/lead-pipeline.server");
          await processLeadEvent({
            leadType: "discovery_call",
            sourceId: `${row.id}:${update.status}:${event.start_time ?? body.created_at ?? ""}`,
            source: `calendly_${body.event}`,
            sourcePage: "/book",
            fullName: [updated?.first_name, updated?.last_name].filter(Boolean).join(" ") || null,
            email: updated?.email ?? body.payload.email ?? null,
            company: updated?.company_name ?? null,
            facts: [
              { label: "Meeting status", value: update.status },
              { label: "Starts", value: event.start_time },
              { label: "Timezone", value: body.payload.timezone },
              { label: "Host", value: host?.user_name },
              { label: "Join link", value: event.location?.join_url },
            ],
            recordTable: "booking_sessions",
            recordId: row.id,
            linkPath: "/admin/pending-leads",
            priority: update.status === "cancelled" ? "high" : "urgent",
            crmStatus: "synced",
          });
        } catch (err) {
          console.error("[calendly] lead notification failed", err);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
