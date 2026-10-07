/**
 * The site-wide call-to-action vocabulary.
 *
 * Two buttons and one text link. Every public page uses these labels and
 * destinations; do not invent new labels for the same two actions.
 * Payments are disabled (`PAYMENTS_ENABLED=false`), so the primary action is a
 * request, never "Buy", "Pay" or "Start free trial".
 */
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import { BOOKING_ROUTE } from "@/config/booking";

/** Primary employer action. Goes to the pilot page, which opens with the short inquiry form. */
export const CTA_PRIMARY = {
  label: `Request my $${PRICE_PILOT_USD} pilot`,
  to: "/pilot",
} as const;

/** Secondary action. Always the native scheduler. */
export const CTA_BOOK = {
  label: "Book a 20-minute call",
  to: BOOKING_ROUTE,
} as const;

/** Quiet link for visitors who want to see the process first. */
export const CTA_HOW_IT_WORKS = {
  label: "See how it works",
  to: "/how-it-works",
} as const;

/** Ready buyers who already have a job description go straight to the full intake. */
export const CTA_FULL_INTAKE = {
  label: "Start the full role intake",
  to: "/intake",
} as const;

/** Opens the contact form, not a calendar. Label must say so. */
export const CTA_MESSAGE = {
  label: "Send us a message",
  to: "/contact",
} as const;

/** Enterprise and more-than-100-position inquiries. */
export const CTA_ENTERPRISE = {
  label: "Talk to us about volume hiring",
  to: "/contact",
} as const;

export const CTA_PRICING = {
  label: "See pricing",
  to: "/pricing",
} as const;
