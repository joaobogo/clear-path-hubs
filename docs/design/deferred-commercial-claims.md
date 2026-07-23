# Deferred Commercial Claims — Phase 3

Per §12, no commercial or statistical claim is transferred without an `APPROVED` entry in the migration claim ledger. All 16 open claims tracked in `docs/migration/claims-ledger.md` remain at `OWNER_DECISION_REQUIRED` and are **not** written into `src/config/brand.ts` or any brand-foundation surface.

## Excluded from brand config (do not restore without approval)

- Two-week / 14-day delivery timing
- Pricing tiers, subscription figures
- Cost-per-hire benchmarks
- Agency-fee percentage comparisons
- LinkedIn Recruiter / job-board cost comparisons
- Savings percentages
- Monthly hiring capacity
- Countries covered count
- Visa / relocation guarantees
- Delivery-volume figures
- Time-to-shortlist / time-to-offer numbers

## Neutral fallback messaging

Where the source used a specific claim, destination copy uses a brand-safe neutral phrasing (e.g. "delivery timing shared during intake", "commercial terms shared on request", "coverage confirmed per role"). Existing preserved destination wording is not modified in Phase 3.

## Resolution

Claims move from this list into `src/config/brand.ts` (or the relevant marketing route) only after they are marked `APPROVED` in the claim ledger by an authorised owner. Track owner sign-off in `docs/migration/claims-ledger.md`.
