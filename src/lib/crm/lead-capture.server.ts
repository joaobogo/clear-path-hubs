import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import type { LeadEventInput } from "@/lib/leads/lead-event";
import { CRM_FORMS, CRM_PRODUCTION_DOMAIN, CRM_SOURCE_BRAND, CRM_SOURCE_WEBSITE, FORM_SERVICE_INTEREST, SERVICE_ROUTING, deriveLeadType, deriveCrossSellStatus, type CrmFormId } from "./attio-config";
import { resolveCompanyDomain, sanitizeAnswers, syncSubmissionToAttio, type CrmSubmission } from "./attio-sync.server";

export function leadCrmForm(input: LeadEventInput): CrmFormId | null {
  if (input.leadType === "candidate_application") return null;
  if (input.leadType === "contact_message") {
    const topic = input.facts?.find((fact) => fact.label === "Topic")?.value;
    return topic === "support" || topic === "candidate" ? null : "contact-page";
  }
  if (input.leadType === "employer_intake" || input.leadType === "express_intake") return "employer-intake";
  if (input.leadType === "discovery_call" || input.source === "inquiry_call") return "book-a-call";
  return input.leadType === "marketing_inquiry" ? "website-message" : null;
}

/** Persist before sending; reuse the primary record ID across retries. */
export async function captureLeadToCrm(input: LeadEventInput) {
  const formId = leadCrmForm(input);
  if (!formId) return { status: "not_applicable" as const, detail: null };
  const email = z.string().trim().toLowerCase().email().safeParse(input.email);
  const id = z.string().uuid().safeParse(input.sourceId);
  if (!email.success || !id.success) return { status: "failed" as const, detail: "Invalid lead email or record reference." };
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data: existing, error: lookupError } = await admin.from("crm_submission_queue").select("id,status,attempts").eq("submission_id", id.data).maybeSingle();
  if (lookupError) return { status: "failed" as const, detail: "Could not check CRM delivery." };
  if (existing?.status === "synced") return { status: "synced" as const, detail: null };
  if (existing) return { status: "queued" as const, detail: null };
  const attr = input.attribution ?? {};
  const text = (key: string) => typeof attr[key] === "string" ? String(attr[key]).slice(0, 500) : null;
  const interest = FORM_SERVICE_INTEREST[formId];
  let origin = CRM_SOURCE_WEBSITE as string;
  try { origin = new URL(getRequest().url).origin; } catch { /* Background delivery uses the canonical origin. */ }
  const host = new URL(origin).hostname;
  const production = host === CRM_PRODUCTION_DOMAIN || host === `www.${CRM_PRODUCTION_DOMAIN}`;
  const page = input.sourcePage?.startsWith("/") ? `${origin}${input.sourcePage}` : input.sourcePage ?? null;
  const submission: CrmSubmission = {
    submission_id: id.data, source_form_id: formId, submitted_at: new Date().toISOString(),
    source_page_url: page, source_page_title: null, landing_page: text("landing_page"),
    original_referrer: text("original_referrer"), latest_referrer: text("latest_referrer"),
    utm_source: text("utm_source"), utm_medium: text("utm_medium"), utm_campaign: text("utm_campaign"), utm_content: text("utm_content"), utm_term: text("utm_term"),
    email: email.data, full_name: input.fullName ?? null, phone: input.phone ?? null, job_title: input.contactTitle ?? null,
    linkedin: input.linkedin ?? null, company_name: input.company ?? null, company_domain: resolveCompanyDomain(input.companyWebsite, email.data),
    answers: sanitizeAnswers({ ...Object.fromEntries((input.facts ?? []).map(f => [f.label, f.value])), Message: input.message }),
    consent_status: input.consentStatus ?? "reply_only_no_marketing_consent", consent_at: input.consentStatus ? new Date().toISOString() : null,
    environment: production ? "production" : "preview", is_test: !production, conversion_page: page,
    first_touch_source: text("first_touch_source"), first_touch_medium: text("first_touch_medium"), first_touch_campaign: text("first_touch_campaign"),
    last_touch_source: text("last_touch_source"), last_touch_medium: text("last_touch_medium"), last_touch_campaign: text("last_touch_campaign"),
    gclid: text("gclid"), gbraid: text("gbraid"), wbraid: text("wbraid"), msclkid: text("msclkid"), linkedin_click_id: text("linkedin_click_id"),
    fgv_journey_id: text("fgv_journey_id"), fgv_entry_brand: text("fgv_entry_brand"), fgv_referrer: text("fgv_referrer"),
    first_landing_timestamp: text("first_landing_timestamp"), last_activity_timestamp: text("last_activity_timestamp"),
    service_interest: interest, secondary_service_interest: null, destination_brand: SERVICE_ROUTING[interest].destination_brand,
    lead_type: deriveLeadType(formId, interest), cross_sell_status: deriveCrossSellStatus(interest),
  };
  const { data: queued, error } = await admin.from("crm_submission_queue").insert({
    ...submission, source_brand: CRM_SOURCE_BRAND, source_website: CRM_SOURCE_WEBSITE, source_domain: CRM_PRODUCTION_DOMAIN,
    source_form_name: CRM_FORMS[formId].name, form_type: CRM_FORMS[formId].type, status: "pending",
  }).select("id").single();
  if (error || !queued) return { status: error?.code === "23505" ? "queued" as const : "failed" as const, detail: error?.code === "23505" ? null : "Could not store CRM delivery." };
  try {
    const ids = await syncSubmissionToAttio(submission);
    const { error: updateError } = await admin.from("crm_submission_queue").update({ status: "synced", synced_at: new Date().toISOString(), attempts: 1,
      attio_person_id: ids.personId, attio_company_id: ids.companyId, attio_deal_id: ids.dealId, attio_note_id: ids.noteId, last_error: null,
    }).eq("id", queued.id);
    return { status: updateError ? "queued" as const : "synced" as const, detail: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 400) : "Attio delivery failed.";
    await admin.from("crm_submission_queue").update({ attempts: 1, last_error: detail }).eq("id", queued.id);
    return { status: "queued" as const, detail };
  }
}