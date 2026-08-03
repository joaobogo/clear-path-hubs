import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  topic: z.enum([
    "hire_talent",
    "candidate",
    "existing_client",
    "support",
    "general",
  ]),
  message: z.string().trim().min(10, "Please add a short message").max(4000),
  source: z.string().trim().max(80).default("public_contact_form"),
  // Honeypot — must be empty
  website: z.string().max(0).optional().or(z.literal("")),
  // Simple time-based check — form must be visible for at least 2s
  elapsedMs: z.number().int().min(0).max(3_600_000).optional(),
  // Affirmative marketing consent — only true when the visitor ticked the box.
  marketingConsent: z.boolean().default(false),
  // Required privacy-notice acknowledgement — the form cannot submit without it.
  privacyAcknowledged: z.literal(true),
  // Campaign + page attribution, captured for EVERY topic (including support
  // and candidate, which never reach the CRM adapter).
  attribution: z.record(z.string(), z.unknown()).nullable().optional(),
  pageContext: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const Route = createFileRoute("/api/public/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = crypto.randomUUID();
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { ok: false, trace_id: traceId, error: "invalid_json" },
            { status: 400 },
          );
        }
        const parsed = contactSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              ok: false,
              trace_id: traceId,
              error: "validation_failed",
              issues: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }
        const data = parsed.data;

        // Flatten campaign attribution into queryable columns so every
        // submission — including support and candidate topics that never reach
        // the CRM adapter — is reportable without JSON digging.
        const attr = (data.attribution ?? {}) as Record<string, unknown>;
        const page = (data.pageContext ?? {}) as Record<string, unknown>;
        const str = (...keys: Array<unknown>) => {
          for (const v of keys) {
            if (typeof v === "string" && v.trim().length > 0) return v.trim().slice(0, 500);
          }
          return null;
        };

        // Spam signals — silently accept but do not persist.
        const looksBot =
          (data.website && data.website.length > 0) ||
          (typeof data.elapsedMs === "number" && data.elapsedMs < 1500);
        if (looksBot) {
          return Response.json({ ok: true, trace_id: traceId, accepted: true });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const userAgent = request.headers.get("user-agent") ?? null;

        const { error } = await supabaseAdmin
          .from("contact_messages")
          .insert({
            name: data.name,
            email: data.email,
            company: data.company || null,
            topic: data.topic,
            message: data.message,
            source: data.source,
            user_agent: userAgent,
            marketing_consent: data.marketingConsent,
            consent_status: data.marketingConsent
              ? "explicit_opt_in_contact_form"
              : "no_marketing_consent",
            attribution: (data.attribution ?? null) as never,
            page_context: (data.pageContext ?? null) as never,
            privacy_acknowledged: data.privacyAcknowledged,
            utm_source: str(attr["utm_source"], attr["last_touch_source"], attr["first_touch_source"]),
            utm_medium: str(attr["utm_medium"], attr["last_touch_medium"], attr["first_touch_medium"]),
            utm_campaign: str(attr["utm_campaign"], attr["last_touch_campaign"], attr["first_touch_campaign"]),
            landing_page: str(attr["landing_page"], page["landing_page"]),
            referrer: str(attr["latest_referrer"], attr["original_referrer"], page["referrer"]),
          });

        if (error) {
          return Response.json(
            {
              ok: false,
              trace_id: traceId,
              error: "persist_failed",
              message: error.message,
            },
            { status: 500 },
          );
        }

        // Teams channel ping (non-critical).
        try {
          const { notifyTeamsSafe } = await import("@/lib/teams-notify.server");
          notifyTeamsSafe({
            title: "New contact form submission",
            subtitle: `${data.name}${data.company ? ` · ${data.company}` : ""}`,
            facts: [
              { label: "Email", value: data.email },
              { label: "Topic", value: data.topic },
              { label: "Message", value: data.message },
              { label: "Source", value: data.source },
            ],
            linkPath: "/admin/inbox",
            linkLabel: "Open inbox",
          });
        } catch {
          // ignore
        }

        return Response.json({ ok: true, trace_id: traceId });

      },
    },
  },
});
