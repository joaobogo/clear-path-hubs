/**
 * Retired booking configuration — client-safe.
 *
 * TaaSFlow no longer offers public or in-product booking. Clients and
 * candidates talk off system (email or phone). What remains here:
 *   - SALES_EMAIL, the one sales address shown as a fallback.
 *   - LEGACY_BOOKING_PATHS, old booking URLs that 301 to /contact.
 */

/** Old booking URLs. Each one 301-redirects to /contact (see seo/edge-policy.ts). */
export const LEGACY_BOOKING_PATHS: readonly string[] = [
  "/book",
  "/book-call",
  "/book-a-call",
  "/schedule",
  "/demo",
];

/** Where the legacy booking URLs now land. */
export const BOOKING_REDIRECT_TARGET = "/contact" as const;

/**
 * The one sales address used as the fallback whenever a form cannot complete.
 * Same address the contact page lists.
 */
export const SALES_EMAIL = "sales@taasflow.com" as const;
