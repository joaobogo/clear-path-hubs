/**
 * POST /api/public/submit-to-attio
 *
 * The single server-side entry point for CRM capture. The Attio credential
 * (ATTIO_API_KEY) is read only inside this request path and never returned.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  CRM_ALLOWED_ORIGINS,
  CRM_FORMS,
  CRM_MAX_PAYLOAD_BYTES,
  CRM_PRODUCTION_DOMAIN,
  CRM_SOURCE_BRAND,
  CRM_SOURCE_WEBSITE,
  CROSS_SELL_STATUSES,
  FORM_SERVICE_INTEREST,
  LEAD_TYPES,
  SERVICE_ROUTING,
  type CrmFormId,
  type ServiceInterest,
} from "@/lib/crm/attio-config";
import {
  resolveCompanyDomain,
  sanitizeAnswers,
  sanitizeText,
  syncSubmissionToAttio,
  type CrmSubmission,
} from "@/lib/crm/attio-sync.server";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

const submissionSchema = z.object({
  submission_id: z.string().uuid(),
  source_form_id: z.enum(Object.keys(CRM_FORMS) as [CrmFormId, ...CrmFormId[]]),
  submitted_at: z.string().datetime().optional(),
  source_page_url: optionalText(500),
  source_page_title: optionalText(300),
  landing_page: optionalText(500),
  original_referrer: optionalText(500),
  latest_referrer: optionalText(500),
  utm_source: optionalText(200),
  utm_medium: optionalText(200),
  utm_campaign: optionalText(200),
  utm_content: optionalText(200),
  utm_term: optionalText(200),
  conversion_page: optionalText(500),
  first_touch_source: optionalText(200),
  first_touch_medium: optionalText(200),
  first_touch_campaign: optionalText(200),
  last_touch_source: optionalText(200),
  last_touch_medium: optionalText(200),
  last_touch_campaign: optionalText(200),
  gclid: optionalText(300),
  gbraid: optionalText(300),
  wbraid: optionalText(300),
  msclkid: optionalText(300),
  linkedin_click_id: optionalText(300),
  fgv_journey_id: optionalText(64),
  fgv_entry_brand: optionalText(40),
  fgv_referrer: optionalText(500),
  first_landing_timestamp: optionalText(40),
  last_activity_timestamp: optionalText(40),
  service_interest: z
    .enum(Object.keys(SERVICE_ROUTING) as [ServiceInterest, ...ServiceInterest[]])
    .optional(),
  secondary_service_interest: z
    .enum(Object.keys(SERVICE_ROUTING) as [ServiceInterest, ...ServiceInterest[]])
    .optional()
    .nullable(),
  lead_type: z.enum(LEAD_TYPES).optional().nullable(),
  cross_sell_status: z.enum(CROSS_SELL_STATUSES).optional().nullable(),
  is_test: z.boolean().optional(),
  email: z.string().trim().toLowerCase().email().max(254),
  full_name: optionalText(160),
  phone: optionalText(40),
  job_title: optionalText(160),
  linkedin: optionalText(300),
  company_name: optionalText(200),
  company_domain: optionalText(200),
  answers: z.record(z.string(), z.unknown()).default({}),
  consent_status: optionalText(80),
  consent_at: z.string().datetime().optional().nullable(),
  // Honeypot: accept any value here so bots get a silent 200 instead of a
  // validation error that would teach them which field to leave blank.
  website: z.string().max(200).optional().nullable(),
});

// Simple in-memory rate limit (per isolate): 5 submissions / minute / IP.
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 5;
}

export const Route = createFileRoute("/api/public/submit-to-attio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && !CRM_ALLOWED_ORIGINS.includes(origin)) {
          return Response.json({ ok: false, error: "origin_not_allowed" }, { status: 403 });
        }

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        if (rateLimited(ip)) {
          return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
        }

        const raw = await request.text();
        if (raw.length > CRM_MAX_PAYLOAD_BYTES) {
          return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(raw);
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }

        const parsed = submissionSchema.safeParse(parsedJson);
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: "validation_failed", issues: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const input = parsed.data;

        // Honeypot — accept silently, persist nothing.
        if (input.website && input.website.length > 0) {
          return Response.json({ ok: true, queued: false, accepted: true });
        }

        // Server decides brand + environment; the browser is never trusted.
        const host = (request.headers.get("host") ?? "").toLowerCase();
        const environment: "production" | "preview" = host.endsWith(CRM_PRODUCTION_DOMAIN)
          ? "production"
          : "preview";

        const serviceInterest: ServiceInterest =
          input.service_interest ?? FORM_SERVICE_INTEREST[input.source_form_id];

        const submission: CrmSubmission = {
          submission_id: input.submission_id,
          source_form_id: input.source_form_id,
          submitted_at: input.submitted_at ?? new Date().toISOString(),
          source_page_url: sanitizeText(input.source_page_url, 500) || null,
          source_page_title: sanitizeText(input.source_page_title, 300) || null,
          landing_page: sanitizeText(input.landing_page, 500) || null,
          original_referrer: sanitizeText(input.original_referrer, 500) || null,
          latest_referrer: sanitizeText(input.latest_referrer, 500) || null,
          utm_source: sanitizeText(input.utm_source, 200) || null,
          utm_medium: sanitizeText(input.utm_medium, 200) || null,
          utm_campaign: sanitizeText(input.utm_campaign, 200) || null,
          utm_content: sanitizeText(input.utm_content, 200) || null,
          utm_term: sanitizeText(input.utm_term, 200) || null,
          email: input.email,
          full_name: sanitizeText(input.full_name, 160) || null,
          phone: sanitizeText(input.phone, 40) || null,
          job_title: sanitizeText(input.job_title, 160) || null,
          linkedin: sanitizeText(input.linkedin, 300) || null,
          company_name: sanitizeText(input.company_name, 200) || null,
          company_domain: resolveCompanyDomain(input.company_domain, input.email),
          answers: sanitizeAnswers(input.answers),
          consent_status: sanitizeText(input.consent_status, 80) || null,
          consent_at: input.consent_at ?? null,
          environment,
          conversion_page: sanitizeText(input.conversion_page, 500) || null,
          first_touch_source: sanitizeText(input.first_touch_source, 200) || null,
          first_touch_medium: sanitizeText(input.first_touch_medium, 200) || null,
          first_touch_campaign: sanitizeText(input.first_touch_campaign, 200) || null,
          last_touch_source: sanitizeText(input.last_touch_source, 200) || null,
          last_touch_medium: sanitizeText(input.last_touch_medium, 200) || null,
          last_touch_campaign: sanitizeText(input.last_touch_campaign, 200) || null,
          gclid: sanitizeText(input.gclid, 300) || null,
          gbraid: sanitizeText(input.gbraid, 300) || null,
          wbraid: sanitizeText(input.wbraid, 300) || null,
          msclkid: sanitizeText(input.msclkid, 300) || null,
          linkedin_click_id: sanitizeText(input.linkedin_click_id, 300) || null,
          fgv_journey_id: sanitizeText(input.fgv_journey_id, 64) || null,
          fgv_entry_brand: sanitizeText(input.fgv_entry_brand, 40) || null,
          fgv_referrer: sanitizeText(input.fgv_referrer, 500) || null,
          first_landing_timestamp: input.first_landing_timestamp ?? null,
          last_activity_timestamp: input.last_activity_timestamp ?? null,
          // The server, not the browser, decides routing from the interest.
          service_interest: serviceInterest,
          secondary_service_interest: input.secondary_service_interest ?? null,
          destination_brand: SERVICE_ROUTING[serviceInterest].destination_brand,
          lead_type: input.lead_type ?? null,
          cross_sell_status: input.cross_sell_status ?? null,
          is_test: input.is_test === true || environment !== "production",
        };

        const form = CRM_FORMS[submission.source_form_id];
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency — the submission_id is unique in the queue.
        const { data: existing } = await supabaseAdmin
          .from("crm_submission_queue")
          .select("id, status")
          .eq("submission_id", submission.submission_id)
          .maybeSingle();

        if (existing?.status === "synced") {
          return Response.json({ ok: true, queued: false, duplicate: true });
        }

        let queueId = existing?.id ?? null;
        if (!queueId) {
          const { data: inserted, error: insertError } = await supabaseAdmin
            .from("crm_submission_queue")
            .insert({
              submission_id: submission.submission_id,
              source_brand: CRM_SOURCE_BRAND,
              source_website: CRM_SOURCE_WEBSITE,
              source_domain: CRM_PRODUCTION_DOMAIN,
              environment: submission.environment,
              source_form_id: form.id,
              source_form_name: form.name,
              form_type: form.type,
              source_page_url: submission.source_page_url,
              source_page_title: submission.source_page_title,
              landing_page: submission.landing_page,
              original_referrer: submission.original_referrer,
              latest_referrer: submission.latest_referrer,
              utm_source: submission.utm_source,
              utm_medium: submission.utm_medium,
              utm_campaign: submission.utm_campaign,
              utm_content: submission.utm_content,
              utm_term: submission.utm_term,
              email: submission.email,
              full_name: submission.full_name,
              phone: submission.phone,
              job_title: submission.job_title,
              linkedin: submission.linkedin,
              company_name: submission.company_name,
              company_domain: submission.company_domain,
              answers: submission.answers,
              consent_status: submission.consent_status,
              consent_at: submission.consent_at,
              submitted_at: submission.submitted_at,
              conversion_page: submission.conversion_page,
              first_touch_source: submission.first_touch_source,
              first_touch_medium: submission.first_touch_medium,
              first_touch_campaign: submission.first_touch_campaign,
              last_touch_source: submission.last_touch_source,
              last_touch_medium: submission.last_touch_medium,
              last_touch_campaign: submission.last_touch_campaign,
              gclid: submission.gclid,
              gbraid: submission.gbraid,
              wbraid: submission.wbraid,
              msclkid: submission.msclkid,
              linkedin_click_id: submission.linkedin_click_id,
              fgv_journey_id: submission.fgv_journey_id,
              fgv_entry_brand: submission.fgv_entry_brand,
              fgv_referrer: submission.fgv_referrer,
              first_landing_timestamp: submission.first_landing_timestamp,
              last_activity_timestamp: submission.last_activity_timestamp,
              service_interest: submission.service_interest,
              secondary_service_interest: submission.secondary_service_interest,
              destination_brand: submission.destination_brand,
              lead_type: submission.lead_type,
              cross_sell_status: submission.cross_sell_status,
              is_test: submission.is_test,
              status: "pending",
            })
            .select("id")
            .single();

          if (insertError) {
            console.error("[crm] queue insert failed", {
              submission_id: submission.submission_id,
              form: form.id,
              code: insertError.code,
            });
          } else {
            queueId = inserted.id;
          }
        }

        try {
          const ids = await syncSubmissionToAttio(submission);
          if (queueId) {
            await supabaseAdmin
              .from("crm_submission_queue")
              .update({
                status: "synced",
                synced_at: new Date().toISOString(),
                attempts: (existing ? 1 : 0) + 1,
                attio_person_id: ids.personId,
                attio_company_id: ids.companyId,
                attio_deal_id: ids.dealId,
                attio_note_id: ids.noteId,
                last_error: null,
              })
              .eq("id", queueId);
          }
          console.info("[crm] synced", {
            submission_id: submission.submission_id,
            form: form.id,
          });
          return Response.json({ ok: true, queued: false });
        } catch (error) {
          const message =
            error instanceof Error ? error.message.slice(0, 400) : "attio_unknown_error";
          console.error("[crm] attio sync failed", {
            submission_id: submission.submission_id,
            form: form.id,
            message,
          });
          if (queueId) {
            await supabaseAdmin
              .from("crm_submission_queue")
              .update({
                status: "pending",
                attempts: (existing ? 1 : 0) + 1,
                last_error: message,
              })
              .eq("id", queueId);
            // Durably stored — safe to report success to the visitor.
            return Response.json({ ok: true, queued: true });
          }
          return Response.json({ ok: false, error: "crm_unavailable" }, { status: 503 });
        }
      },
    },
  },
});
