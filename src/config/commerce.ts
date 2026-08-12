/**
 * Commerce switch.
 *
 * Stripe is not live yet. When this is true, checkout surfaces across the app
 * are enabled and the intake form ends with a pay-or-call choice. When false,
 * every payment CTA is gated and the intake form always routes to booking.
 * Flipping this single line restores payments everywhere — no code, tables,
 * webhooks or tests are deleted when it is false.
 */
export const PAYMENTS_ENABLED = false;

export function paymentsEnabled(): boolean {
  return PAYMENTS_ENABLED;
}
