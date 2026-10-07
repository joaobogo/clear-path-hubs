/**
 * TaaSFlow — public offer facts (single source for marketing copy).
 *
 * Every public page, FAQ, schema block and AI fact file that states how the
 * offer works must read from here instead of typing its own number or promise.
 * Prices stay in `pricing-core.ts`; this file holds everything else a buyer is
 * told: timing, process, who does the work, the call, the response time.
 *
 * Rules for editing:
 *   - Never write a guarantee here. Remedies need owner approval first.
 *   - Timing is a usual outcome for an approved role brief, never a promise.
 *   - Do not read this from the admin dashboard or client workspace; those
 *     surfaces have their own constants (`TURNAROUND_LABEL`, business rules).
 */
import { PRICE_PILOT_USD } from "@/config/pricing-core";

export const BRAND_NAME = "TaaSFlow" as const;

/** The one category name used on public pages. */
export const OFFER_CATEGORY = "Recruiting platform with managed execution" as const;

/** Short descriptor for titles and eyebrows. */
export const OFFER_EYEBROW = "Recruiting platform + managed execution" as const;

/** Who does the work — the one sentence used everywhere. */
export const WHO_RUNS_THE_SEARCH =
  "Agents source and score candidates. A recruiter reviews every shortlist before you see it. You make every hiring decision." as const;

/** Shorter form for tight spaces. */
export const WHO_RUNS_THE_SEARCH_SHORT =
  "Agents source and score. A recruiter reviews. You decide." as const;

/** What the buyer receives. */
export const SHORTLIST_SIZE = 10 as const;
export const SHORTLIST_LABEL = `A ranked shortlist of up to ${SHORTLIST_SIZE} candidates` as const;

/**
 * Timing. A usual outcome from an approved role brief — not a guarantee.
 * Business days, clock starts when the role brief is approved.
 */
export const FIRST_SHORTLIST_BUSINESS_DAYS = 5 as const;
export const FIRST_SHORTLIST_TIMING =
  `Your first ranked shortlist usually arrives within ${FIRST_SHORTLIST_BUSINESS_DAYS} business days of an approved role brief.` as const;
export const FIRST_SHORTLIST_TIMING_SHORT =
  `Usually ${FIRST_SHORTLIST_BUSINESS_DAYS} business days from an approved brief` as const;
export const TIMING_FINE_PRINT =
  "Timing depends on the role, the market and how quickly the brief is approved. It is not a guarantee." as const;

/** The pilot, in words. Price comes from pricing-core. */
export const PILOT_PRICE_USD = PRICE_PILOT_USD;
export const PILOT_SUMMARY =
  `One role, one time per company, $${PRICE_PILOT_USD}.` as const;
export const PILOT_IS_PAID_NOTE =
  "The pilot is a paid evaluation of one role. It is not a free trial." as const;

/** The process: four steps, everywhere. */
export const PROCESS_STEPS = [
  {
    title: "Share the role",
    body: "Send a short inquiry or the full role brief. No sourcing starts until the scope is confirmed.",
  },
  {
    title: "Approve the plan",
    body: "We confirm the role, the criteria and the pilot scope with you on a call or by email.",
  },
  {
    title: "Sourcing and screening",
    body: "Agents source and score candidates against your criteria. A recruiter reviews the results.",
  },
  {
    title: "Review your shortlist",
    body: "You get a ranked shortlist with the evidence behind each score, in your workspace. You decide who to interview.",
  },
] as const;
export const PROCESS_STEP_COUNT = PROCESS_STEPS.length;

/** The call. One name, one length. */
export const CALL_NAME = "20-minute call" as const;
export const CALL_MINUTES = 20 as const;

/** One response time for general inquiries. */
export const RESPONSE_TIME = "within one business day" as const;
export const RESPONSE_TIME_SENTENCE =
  "We reply within one business day." as const;

/** Files accepted on the intake. Mirrors the intake validator. */
export const ACCEPTED_UPLOADS = "PDF, DOCX, TXT or RTF" as const;

/** Candidate records. Rights and access are different things. */
export const RECORDS_NOTE =
  "You can export your candidate records at any time. Workspace access for a one-off package lasts three months; records are deleted after that unless you renew." as const;

/** Seats. Mirrors pricing-entitlements; used where copy mentions teammates. */
export const SEATS_NOTE =
  "Seats depend on your package. The pilot includes two seats: one owner and one recruiter." as const;

/** Human-oversight wording for AI use in hiring. */
export const HUMAN_OVERSIGHT_NOTE =
  "No candidate is rejected or advanced by software alone. Scores support a person’s decision; they do not make it." as const;

/** Integration honesty: what is live today. */
export const ATS_NOTE =
  "The TaaSFlow workspace includes its own applicant tracking. Direct sync with an external ATS is planned, not built." as const;
export const JOB_BOARD_NOTE =
  "Roles are published on the TaaSFlow job board. Outbound distribution to external job boards is planned, not built." as const;

/** Security / compliance honesty. */
export const COMPLIANCE_NOTE =
  "We do not claim SOC 2, ISO 27001, HIPAA, or full GDPR, CCPA or PDPL compliance. See the security page for what we do and do not hold." as const;

/** Date the public offer pages (pricing, pilot, homepage) were last reviewed for accuracy. */
export const OFFER_LAST_REVIEWED = "7 October 2026" as const;
export const OFFER_LAST_UPDATED_LABEL = `Last updated: ${OFFER_LAST_REVIEWED}` as const;
