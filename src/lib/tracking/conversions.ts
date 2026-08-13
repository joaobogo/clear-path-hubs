/**
 * Conversion tracking helpers.
 * ---------------------------
 * Call sites use these three functions instead of raw `trackEvent`, so the
 * canonical event name and its properties are decided in one place and every
 * pixel provider receives its own dialect (see `conversion-map.ts`).
 *
 * NO PII: pass identifiers and categories only. `trackEvent` scrubs known
 * personal keys and anything that looks like an email, but do not rely on it.
 */
import { trackEvent } from "@/lib/tracking/pixels";
import { CONVERSIONS } from "@/lib/tracking/conversion-map";

function pagePath(): string | undefined {
  return typeof window === "undefined" ? undefined : window.location.pathname;
}

/**
 * A form was submitted successfully (server-confirmed). Never fire this on
 * click, on validation failure, or on a client-side timeout.
 */
export function trackFormSubmit(args: {
  /** Stable id of the form, e.g. "express_intake". */
  formId: string;
  /** Business category, e.g. "employer_intake" | "sales_contact". */
  formType: string;
  /** Server-issued submission/reference id, when there is one. */
  submissionId?: string;
  /** Indicative lead value for ad platforms. */
  value?: number;
  currency?: string;
  extra?: Record<string, unknown>;
}) {
  trackEvent(CONVERSIONS.formSubmit, {
    form_id: args.formId,
    form_type: args.formType,
    submission_id: args.submissionId,
    value: args.value,
    currency: args.value !== undefined ? (args.currency ?? "GBP") : undefined,
    page_path: pagePath(),
    ...args.extra,
  });
}

/** A visitor clicked a tracked call to action. */
export function trackCtaClick(
  cta: string,
  params: { ctaLocation?: string; destination?: string; extra?: Record<string, unknown> } = {},
) {
  trackEvent(CONVERSIONS.ctaClick, {
    cta,
    cta_location: params.ctaLocation,
    destination: params.destination,
    page_path: pagePath(),
    ...params.extra,
  });
}

/** A workspace account was created and the user reached the dashboard. */
export function trackDashboardSignup(args: {
  /** How the account was created, e.g. "email_password" | "google". */
  method: string;
  /** Plan or flow the account started on, e.g. "pilot" | "express_onboarding". */
  plan?: string;
  extra?: Record<string, unknown>;
}) {
  trackEvent(CONVERSIONS.dashboardSignup, {
    method: args.method,
    plan: args.plan,
    page_path: pagePath(),
    ...args.extra,
  });
}
