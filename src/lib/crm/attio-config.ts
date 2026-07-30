/**
 * CRM (Attio) integration — shared, client-safe configuration.
 *
 * NOTE: this file must never contain credentials. The Attio token lives only
 * in the server secret ATTIO_API_KEY and is read inside server handlers.
 */

export const CRM_SOURCE_BRAND = "TaaSFlow" as const;
export const CRM_SOURCE_WEBSITE = "https://www.taasflow.com" as const;
export const CRM_PRODUCTION_DOMAIN = "taasflow.com" as const;

/** Origins allowed to POST to the CRM endpoint. */
export const CRM_ALLOWED_ORIGINS: readonly string[] = [
  "https://www.taasflow.com",
  "https://taasflow.com",
  "https://clear-path-hubs.lovable.app",
  "http://localhost:8080",
];

export type CrmFormType =
  | "sales_contact"
  | "consultation"
  | "quote_request"
  | "newsletter"
  | "partnership"
  | "client_intake";

export type CrmFormDefinition = {
  /** Permanent, human-readable identifier. Never auto-generated. */
  id: string;
  name: string;
  type: CrmFormType;
};

/**
 * Registry of every form approved for CRM capture. Anything not listed here is
 * rejected by the server (auth, password reset, candidate applications,
 * support and authenticated dashboard forms are deliberately excluded).
 */
export const CRM_FORMS = {
  "contact-page": {
    id: "contact-page",
    name: "Contact page",
    type: "sales_contact",
  },
  "book-a-call": {
    id: "book-a-call",
    name: "Book a call",
    type: "consultation",
  },
  "website-message": {
    id: "website-message",
    name: "Website message",
    type: "sales_contact",
  },
  "employer-intake": {
    id: "employer-intake",
    name: "Employer role launch intake",
    type: "client_intake",
  },
  "partner-inquiry": {
    id: "partner-inquiry",
    name: "Partner inquiry",
    type: "partnership",
  },
  "newsletter-signup": {
    id: "newsletter-signup",
    name: "Newsletter signup",
    type: "newsletter",
  },
} as const satisfies Record<string, CrmFormDefinition>;

export type CrmFormId = keyof typeof CRM_FORMS;

/** Form types that should open/update a sales Deal. */
export const DEAL_FORM_TYPES: readonly CrmFormType[] = [
  "sales_contact",
  "consultation",
  "quote_request",
  "client_intake",
];

export const CRM_MAX_PAYLOAD_BYTES = 32 * 1024;
