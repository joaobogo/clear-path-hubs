# Entitlements awaiting internal commercial confirmation

Source of truth: `src/config/pricing-entitlements.ts` (`pending()` entries).
These render publicly as “Confirmed on your quote” — never as a fabricated number.

| Entitlement | Plans | Why it is pending |
| --- | --- | --- |
| Workspace seats | Pilot, Multi, Sprint, Bronze, Silver, Gold | No per-plan seat count is defined in the commercial model. Workspace access is currently governed by role-based access control, not a published seat tier. |
| Audit exports | Pilot, Multi, Sprint, Bronze, Silver | Export scope (formats, frequency, who may export) is not defined per plan. Gold is covered by “custom reporting”. |
| Integration access | Pilot, Multi, Sprint, Bronze, Silver, Gold | Email/calendar coordination exists in the product, but no per-plan entitlement or connector list has been agreed commercially. |

## To confirm

1. Seat count (or “unlimited”) per published plan.
2. Audit export scope per plan, and whether export is admin-only.
3. Which integrations are entitled per plan.

Once confirmed, replace the `pending(...)` call with `value("…")` in
`src/config/pricing-entitlements.ts`. No other file needs to change.

## Not changed by the entitlement rework

Prices (`src/config/pricing-core.ts`), billing logic, Stripe products/checkout
destinations, webhook handling, and contractual claims are untouched. All CTA
destinations on `/pricing` remain `/contact`, `/enterprise`, `/intake`.
