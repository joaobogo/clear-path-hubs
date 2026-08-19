---
name: hire-metric-reconciliation
description: Synchronize hire counts across admin dashboard, rollup panels, and weekly reviews to use a single deterministic source.
type: feature
---

# Hire Metric Reconciliation Plan

Hired candidates are currently reported inconsistently across three surfaces (Admin Tile: 1, Rollup: 0, WBR: 0) because they use different filters (e.g., stage vs. hire records vs. dates). This plan unifies all reporting on `hire_records.status = 'hire_confirmed'`.

## User Summary
We are fixing a discrepancy where the number of confirmed hires was showing differently on various dashboard screens. We will standardize all counts to use confirmed hire records as the single source of truth, ensuring that once a hire is recorded, it shows up consistently across the entire platform.

## Proposed Changes

### 1. Data Logic (`src/lib/offer-hire.ts` & `src/lib/offer-hire.server.ts`)
- The logic in `qualifiesAsHire` already targets `hire_confirmed`. We will maintain this as the core predicate.
- No changes needed to `summarise` or `loadOfferHireRollup` as they already use this predicate correctly, but they depend on the record existing.

### 2. Admin Work Queue (`src/lib/admin-ops.server.ts`)
- Refactor the `hiredCount` logic (approx. line 180) to query `hire_records` instead of `candidate_matches`.
- **Change:** Count rows in `hire_records` where `status = 'hire_confirmed'`.

### 3. Weekly Operating Review (`src/lib/wbr-review.server.ts`)
- Refactor the `hires` query (approx. line 131) to be more deterministic.
- **Change:** Ensure the query correctly captures `hire_confirmed` records. The current query uses `hired_at`, which might be null even if the status is confirmed. We will ensure `hired_at` is populated upon confirmation or use it as the primary time-boundary.

### 4. Admin Dashboard UI (`src/routes/_authenticated/admin.index.tsx`)
- Update the "Hires confirmed" tile in `WorkQueueSummary` to use the new rollup data if it's available, ensuring the "1 vs 0" discrepancy is resolved visually.

## Technical Details
- **Source of Truth:** `hire_records` table where `status = 'hire_confirmed'`.
- **Admin Tile:** Currently suspicious of `candidate_matches.stage = 'hired'`. Will switch to `hire_records` count.
- **WBR:** Currently uses `hire_records.hired_at`. Will verify that `recordOfferOutcome` stamps `hired_at` when `outcome` is `hire_confirmed`.

## Verification Plan
1. **Manual Check:** Inspect a candidate marked "Hired" (e.g., Beatriz Costa).
2. **Database Verification:** Verify that `hired_at` is set on the `hire_records` row.
3. **UI Verification:** Confirm all three surfaces (Admin Tile, Rollup Panel, and WBR) show the same count for the specified week.
