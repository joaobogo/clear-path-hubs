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
