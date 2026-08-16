/**
 * Conversion mapping table.
 * ------------------------
 * One canonical event name per business action, plus the name and properties
 * each pixel provider expects for it. Providers disagree on vocabulary:
 *
 *   canonical          GA4                Meta                    LinkedIn
 *   form_submit        generate_lead      Lead                    numeric conv. id
 *   cta_click          cta_click          (none — micro event)    optional conv. id
 *   dashboard_signup   sign_up            CompleteRegistration    numeric conv. id
 *
 * This module is deliberately dependency-free (no browser globals at module
 * scope, no import from `pixels.ts`) so it stays SSR-safe and unit-testable.
 * `pixels.ts` reads it inside `send()`; `conversions.ts` provides the typed
 * helpers call sites use.
 */

/** Canonical conversion events we optimise and report on. */
export const CONVERSIONS = {
  formSubmit: "form_submit",
  ctaClick: "cta_click",
  dashboardSignup: "dashboard_signup",
} as const;

export type ConversionName = (typeof CONVERSIONS)[keyof typeof CONVERSIONS];

/** LinkedIn wants numeric conversion ids from Campaign Manager, not names. */
const LINKEDIN_CONVERSION_IDS: Record<string, string> = {
  form_submit: import.meta.env.VITE_LINKEDIN_CONV_FORM_SUBMIT || "",
  dashboard_signup: import.meta.env.VITE_LINKEDIN_CONV_SIGNUP || "",
  cta_click: import.meta.env.VITE_LINKEDIN_CONV_CTA_CLICK || "",
};

type ProviderMapping = {
  /** GA4 / dataLayer event name. Defaults to the canonical name. */
  ga4?: string;
  /** Meta standard event name; omitted means "do not send to Meta". */
  meta?: string;
  /** Which canonical payload keys Meta should receive, and under what name. */
  metaParams?: Record<string, string>;
  /** Clarity/Hotjar label (they take a single string). */
  label?: string;
  /** LinkedIn conversion id key; omitted means "do not send to LinkedIn". */
  linkedin?: keyof typeof LINKEDIN_CONVERSION_IDS;
};

/**
 * Canonical name -> per-provider mapping. Entries below `formSubmit` are the
 * pre-existing funnel events, kept so their Meta mapping does not regress.
 */
export const CONVERSION_MAP: Record<string, ProviderMapping> = {
  [CONVERSIONS.formSubmit]: {
    ga4: "generate_lead",
    meta: "Lead",
    metaParams: {
      form_type: "content_category",
      form_id: "content_name",
      value: "value",
      currency: "currency",
    },
    label: "form_submit",
    linkedin: "form_submit",
  },
  [CONVERSIONS.ctaClick]: {
    ga4: "cta_click",
    // No Meta standard event: a click is a micro-conversion, not a Lead.
    metaParams: { cta: "content_name", cta_location: "content_category" },
    label: "cta_click",
    linkedin: "cta_click",
  },
  [CONVERSIONS.dashboardSignup]: {
    ga4: "sign_up",
    meta: "CompleteRegistration",
    metaParams: { method: "content_name", plan: "content_category" },
    label: "dashboard_signup",
    linkedin: "dashboard_signup",
  },

  // ---- existing funnel events (unchanged behaviour) ----
  page_view: { meta: "PageView" },
  view_job_board: { meta: "ViewContent" },
  view_job: { meta: "ViewContent" },
  application_started: { meta: "InitiateCheckout" },
  cv_selected: { meta: "AddPaymentInfo" },
  application_submitted: { meta: "SubmitApplication" },
  contact_form_submitted: { meta: "Contact" },
  candidate_signup_started: { meta: "CompleteRegistration" },
  candidate_account_invited: { meta: "CompleteRegistration" },
};

export type ResolvedConversion = {
  /** Name GA4 and the dataLayer receive. */
  ga4Event: string;
  /** Single-string label for Clarity / Hotjar. */
  label: string;
  meta: { event: string; params: Record<string, unknown> } | null;
  linkedin: { conversion_id: string } | null;
};

/**
 * Translates a canonical event + payload into what each provider should get.
 * Unmapped events fall through with their own name and no Meta/LinkedIn hit.
 */
export function resolveConversion(
  name: string,
  payload: Record<string, unknown> = {},
): ResolvedConversion {
  const mapping = CONVERSION_MAP[name];
  const ga4Event = mapping?.ga4 ?? name;

  let meta: ResolvedConversion["meta"] = null;
  if (mapping?.meta) {
    const params: Record<string, unknown> = {};
    for (const [from, to] of Object.entries(mapping.metaParams ?? {})) {
      if (payload[from] !== undefined) params[to] = payload[from];
    }
    // Anything not explicitly renamed still passes through unchanged, matching
    // the previous behaviour of forwarding the whole payload.
    meta = { event: mapping.meta, params: { ...payload, ...params } };
  }

  const linkedinId = mapping?.linkedin
    ? LINKEDIN_CONVERSION_IDS[mapping.linkedin]
    : "";

  return {
    ga4Event,
    label: mapping?.label ?? name,
    meta,
    // LinkedIn only accepts configured numeric ids — sending a name is a no-op
    // that pollutes the tag, so skip it when no id is configured.
    linkedin: linkedinId ? { conversion_id: linkedinId } : null,
  };
}
