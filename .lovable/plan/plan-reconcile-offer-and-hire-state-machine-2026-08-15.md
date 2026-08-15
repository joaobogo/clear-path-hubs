# Plan: Reconcile Offer and Hire State Machine

Centralize offer and hire definitions to ensure consistency across the Offers page, Executive dashboard, and Insights funnel. Fix data contradictions for Beatriz Costa and Rui Fernandes.

## User Review Required

> [!IMPORTANT]
> - Data for **Beatriz Costa** will be corrected from "Closed lost" to "Hire confirmed" to match her platform stage.
> - A missing offer record for **Rui Fernandes** will be created so he appears on the Offers board.

## Proposed Changes

### Core Logic & Definitions
- **Centralize offer/hire predicates** in `src/lib/offer-hire.ts` with explicit documentation of "open", "decided", and "hire" states.
- **Update derived counts** in `src/lib/client-kpi.server.ts` to use these centralized definitions, ensuring dashboard tiles and Offers page tiles agree.

### Reporting & Analytics
- **Hardened `getTimeToHireReport`** in `src/lib/hires.functions.ts` to use canonical KPI derivations for "Hires by owner" and "Acceptance rate".
- **Synchronize Executive summary** in `src/lib/executive.functions.ts` to use unified definitions for hire counts (30D/90D/YTD) and open offer values.

### Data Corrections
- **Fix Beatriz Costa**: Update `hire_records` from `closed_lost` to `hire_confirmed` (August 13, 2026).
- **Fix Rui Fernandes**: Insert missing `hire_records` entry (status `offer_sent`, Aug 15) to match his pipeline stage.
- **Add Invariant Guard**: Update `upsertOfferDraft` to prevent creating records that contradict a candidate's already-hired platform status.

## Technical Details
- **Open Offers**: `status IN ('offer_drafted', 'offer_sent', 'offer_negotiating', 'offer_accepted')`.
- **Decided Offers**: `status IN ('offer_accepted', 'offer_declined', 'hire_confirmed', 'closed_lost')`.
- **Hires**: `status = 'hire_confirmed'` with a non-null `hired_at`.
- **Acceptance Rate**: `Accepted / Decided` (where Accepted = `offer_accepted` or `hire_confirmed`).
- **Data fix** will use a direct SQL migration via `supabase--migration` to ensure atomicity.

## Regression Guard
- Existing E2E suite `tests/e2e/workspace-lockin.spec.ts` covers basic dashboard consistency; this fix deepens that lock-in by unifying the underlying server-side logic.
