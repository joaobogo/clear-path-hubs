/**
 * Lead-form funnel events: view, start, error. Non-PII by construction.
 *
 * Only the form type, the placement (`source`) and an error CATEGORY are sent.
 * Values typed by the visitor never reach analytics, URLs or the console.
 * The business conversion (`generate_lead`) stays in `trackConfirmedConversion`
 * and fires only after the server has accepted the inquiry.
 */
import { FGV_EVENTS, trackFgv } from "@/lib/tracking/fgv-events";

export const EMPLOYER_INQUIRY_FORM_TYPE = "employer_inquiry";

/** Error categories that may be reported. Anything else collapses to "unknown". */
const ERROR_CATEGORIES = new Set([
  "firstName_invalid",
  "email_invalid",
  "phone_invalid",
  "position_invalid",
  "multiple_fields",
  "server_rejected",
  "network_error",
  "rate_limited",
  "unknown",
]);

export function safeErrorCategory(category: string): string {
  return ERROR_CATEGORIES.has(category) ? category : "unknown";
}

export function leadFormEventParams(source: string, errorCategory?: string): Record<string, unknown> {
  return {
    form_type: EMPLOYER_INQUIRY_FORM_TYPE,
    referral_context: source,
    error_code: errorCategory === undefined ? undefined : safeErrorCategory(errorCategory),
  };
}

function safeTrack(name: Parameters<typeof trackFgv>[0], params: Record<string, unknown>) {
  try {
    trackFgv(name, params);
  } catch {
    /* analytics must never block the form */
  }
}

export function trackLeadFormView(source: string) {
  safeTrack(FGV_EVENTS.leadFormView, leadFormEventParams(source));
}

export function trackLeadFormStart(source: string) {
  safeTrack(FGV_EVENTS.leadFormStart, leadFormEventParams(source));
}

export function trackLeadFormError(source: string, category: string) {
  safeTrack(FGV_EVENTS.leadFormError, leadFormEventParams(source, category));
}
