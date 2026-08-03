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

/* ------------------------------------------------ FGV ecosystem taxonomy -- */

export const BRAND_KEY = "taasflow" as const;

/** Services this brand and its siblings own. Never invent new values. */
export type ServiceInterest =
  | "recruiting_subscription"
  | "one_critical_role"
  | "employer_brand_or_demand"
  | "international_expansion";

/** TaaSFlow routing contract: one primary lead, referral as secondary interest. */
export const SERVICE_ROUTING: Record<
  ServiceInterest,
  { destination_brand: "taasflow" | "flowplaced" | "omniflow" | "fgv"; referral: boolean }
> = {
  recruiting_subscription: { destination_brand: "taasflow", referral: false },
  one_critical_role: { destination_brand: "flowplaced", referral: true },
  employer_brand_or_demand: { destination_brand: "omniflow", referral: true },
  international_expansion: { destination_brand: "fgv", referral: true },
};

/** Default service interest per form. Overridable per submission. */
export const FORM_SERVICE_INTEREST: Record<CrmFormId, ServiceInterest> = {
  "contact-page": "recruiting_subscription",
  "book-a-call": "recruiting_subscription",
  "website-message": "recruiting_subscription",
  "employer-intake": "recruiting_subscription",
  "partner-inquiry": "recruiting_subscription",
  "newsletter-signup": "recruiting_subscription",
};

export const LIFECYCLE_STAGES = [
  "New Lead",
  "Marketing Qualified Lead",
  "Sales Qualified Lead",
  "Opportunity",
  "Customer",
  "Nurture",
  "Disqualified",
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const LEAD_TYPES = [
  "Partner",
  "Recruiting Prospect",
  "Marketing Prospect",
  "Expansion Prospect",
  "AI Prospect",
  "Direct-Placement Prospect",
] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const CROSS_SELL_STATUSES = [
  "None",
  "Potential",
  "Cross-Sell Opportunity",
  "Routed",
  "Accepted",
  "Closed",
] as const;
export type CrossSellStatus = (typeof CROSS_SELL_STATUSES)[number];

/** Lead type derived from the form + the service the visitor asked about. */
export function deriveLeadType(formId: CrmFormId, interest: ServiceInterest): LeadType {
  if (CRM_FORMS[formId].type === "partnership") return "Partner";
  switch (interest) {
    case "one_critical_role":
      return "Direct-Placement Prospect";
    case "employer_brand_or_demand":
      return "Marketing Prospect";
    case "international_expansion":
      return "Expansion Prospect";
    default:
      return "Recruiting Prospect";
  }
}

export function deriveCrossSellStatus(interest: ServiceInterest): CrossSellStatus {
  return SERVICE_ROUTING[interest].referral ? "Cross-Sell Opportunity" : "None";
}
