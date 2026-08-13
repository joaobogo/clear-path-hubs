/**
 * FGV standardized analytics events.
 * ---------------------------------
 * One naming convention across all five ecosystem brands. Every event carries
 * `brand_key` and `source_domain` so a shared measurement layer can still be
 * split per brand.
 *
 * HARD RULE: no PII. Names, emails, phone numbers, free-text answers, CV
 * contents, and application details never reach GA4/GTM/Ads/LinkedIn. The
 * `sanitizeParams` guard below drops any key that looks personal and any
 * value that looks like an email or phone number.
 */
import { trackEvent } from "@/lib/tracking/pixels";
import { trackFormSubmit } from "@/lib/tracking/conversions";
import { BRAND_DOMAIN, BRAND_KEY, getJourneyId } from "@/lib/crm/attribution";

export const FGV_EVENTS = {
  formStart: "fgv_form_start",
  formSubmit: "fgv_form_submit",
  formSuccess: "fgv_form_success",
  formError: "fgv_form_error",
  bookingStart: "fgv_booking_start",
  bookingComplete: "fgv_booking_complete",
  contentDownload: "fgv_content_download",
  webinarRegistration: "fgv_webinar_registration",
  assessmentStart: "fgv_assessment_start",
  assessmentComplete: "fgv_assessment_complete",
  jobIntakeStart: "fgv_job_intake_start",
  jobIntakeStep: "fgv_job_intake_step",
  jobIntakeComplete: "fgv_job_intake_complete",
  jobApplicationStart: "fgv_job_application_start",
  jobApplicationComplete: "fgv_job_application_complete",
  pricingView: "fgv_pricing_view",
  pricingCtaClick: "fgv_pricing_cta_click",
  ecosystemSwitch: "fgv_ecosystem_switch",
  crossBrandClick: "fgv_cross_brand_click",
  qualifiedLead: "fgv_qualified_lead",
} as const;

export type FgvEventName = (typeof FGV_EVENTS)[keyof typeof FGV_EVENTS];

/** Parameter keys permitted on ecosystem events. */
const ALLOWED_PARAMS = new Set([
  "brand_key",
  "source_domain",
  "page_path",
  "form_type",
  "service_interest",
  "destination_brand",
  "referral_context",
  "content_asset_id",
  "webinar_id",
  "assessment_type",
  "intake_step",
  "pricing_plan",
  "fgv_journey_id",
  "consent_state",
  "submission_id",
  "error_code",
]);

const LOOKS_PERSONAL = /@|\+?\d[\d\s().-]{7,}/;

export function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_PARAMS.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      if (LOOKS_PERSONAL.test(value)) continue;
      out[key] = value.slice(0, 100);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") out[key] = value;
  }
  return out;
}

function consentState(): string {
  if (typeof window === "undefined") return "unknown";
  try {
    return window.localStorage.getItem("fgv.consent") ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Emit a standardized ecosystem event. Never throws. */
export function trackFgv(name: FgvEventName, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  trackEvent(name, {
    ...sanitizeParams(params),
    brand_key: BRAND_KEY,
    source_domain: BRAND_DOMAIN,
    page_path: window.location.pathname,
    fgv_journey_id: getJourneyId() ?? undefined,
    consent_state: consentState(),
  });
}

/**
 * Business conversion. Fire ONLY after a server-confirmed submission id —
 * never on click, form start, or a client-side timeout.
 */
export function trackConfirmedConversion(args: {
  formType: string;
  serviceInterest?: string;
  destinationBrand?: string;
  submissionId: string;
}) {
  trackFgv(FGV_EVENTS.formSuccess, {
    form_type: args.formType,
    service_interest: args.serviceInterest,
    destination_brand: args.destinationBrand,
    submission_id: args.submissionId,
  });
  // Same moment, canonical conversion name: GA4 generate_lead, Meta Lead,
  // LinkedIn conversion id. Mapping lives in conversion-map.ts.
  trackFormSubmit({
    formId: args.formType,
    formType: args.formType,
    submissionId: args.submissionId,
    extra: { service_interest: args.serviceInterest, destination_brand: args.destinationBrand },
  });
}

/** Outbound hop to a sibling brand. */
export function trackCrossBrandClick(destinationBrand: string, referralContext: string) {
  trackFgv(FGV_EVENTS.crossBrandClick, {
    destination_brand: destinationBrand,
    referral_context: referralContext,
  });
}
