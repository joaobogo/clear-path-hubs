# Calculator vs Pricing Page — Reconciliation

## Values in play

| Value | Source (taasflow.com/pricing) | Destination `src/routes/pricing.tsx` | Destination `src/content/pages/pricing.json` (legacy meta) |
|-------|-------------------------------|--------------------------------------|-------------------------------------------------------------|
| Pilot Single Position price | $399 one-time | Not published — "under review" | not present |
| Multi Position (2–5) price | $2,100 one-time (≈$600/pos) | Not published — "under review" | not present |
| Hiring Sprint (6–10) price | $4,500 one-time (≈$562/pos) | Not published — "under review" | not present |
| Subscription tier (11+) | $6,999/mo (implied by legacy meta) | Not published | `title: "Pricing — Subscription Recruiting from $6,999/mo"` |
| Delivery time claim | 14 days | Removed from destination Pricing page | present in legacy JSON |
| Annual discount | 10% | Not present on destination | present in legacy hero copy |
| Calculator disclaimer | "SHRM & Ashby 2025 benchmarks" | N/A (no calculator yet) | N/A |

## Conflicts

1. **Package prices** — source has published one-off prices; destination pricing route intentionally hides them and routes to sales. Calculator cannot ship without a decision.
2. **Subscription tier** — `$6,999/mo` appears only in legacy JSON metadata (not in the destination user-facing UI). Never approved for the current plan year.
3. **14-day turnaround / 10% annual discount** — source uses these commercial claims; destination removed them (per prior commercial-claims audit).
4. **Default salary** — the source calculator's default `averageSalary` is inferred as $85,000 from the rendered numbers; the label does not display the value publicly.

## Owner decisions required

| # | Decision | Options |
|---|----------|---------|
| 1 | Publish `$399 / $2,100 / $4,500` one-off package prices? | (a) Publish as-is on destination Pricing + calculator; (b) Republish revised numbers; (c) Keep hidden — calculator uses "quote-based" copy for TaaSFlow cost. |
| 2 | Subscription tier price for 11+ positions | (a) Confirm `$6,999/mo`; (b) Provide revised price; (c) Route 11+ to `Contact Sales`, no numeric output. |
| 3 | Default `averageSalary` in calculator | (a) Confirm `$85,000`; (b) Provide new default. |
| 4 | Reinstate "14-day" and "10% annual" claims? | (a) Yes and re-publish; (b) No. |
| 5 | Analytics event names | Confirm `roi_calculator_view / _input_change / _tier_change / _cta_click` (or provide names). |

## Recommended path

- Ship the canonical config with **flagged** placeholder tiers (`approvalStatus: "pending"`) reflecting the source values, plus a `disabled` flag so the calculator hides monetary outputs until an owner marks each tier `approved`.
- Update `src/content/pages/pricing.json` metadata to remove `$6,999/mo` (see next task) so we don't leak an unapproved number in `<title>` / `og:title`.
- Once owner confirms decisions above, flip `approvalStatus` and the calculator + Pricing page render the same numbers automatically.

## Enforcement

- **One canonical file** (`src/config/public-pricing.ts`) is the sole source of package identifiers, ranges, prices, billing type, and status flags.
- Calculator and Pricing page **import from that file only**; components must not hard-code prices.
- A `tests/pricing-parity.test.ts` unit test asserts that the values rendered by the Pricing page and the calculator match the canonical config for every tier.
