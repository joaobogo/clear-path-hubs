# Plan: Unify Client Dashboard "Awaiting Decision" Counts

Unify the "Awaiting your decision" logic across the client workspace to prevent contradictory counts between dashboard tiles. Currently, the "Hiring is on track" tile and the "Waiting on you" tile use slightly different definitions for what constitutes an awaiting decision.

## User Review Required

> [!IMPORTANT]
> The fix involves standardizing all surfaces on the `isAwaitingClientDecision` helper from `src/lib/client-kpi.server.ts`. This rule defines "waiting on the client" as a candidate sitting at the `delivered` stage with no `client_decisions` record.

- **Check**: The user noted that "Hiring is on track" showed 0 while "Waiting on you" showed 1. This happened because `src/lib/client-overview.functions.ts` had a local `awaitingDecision` helper that checked `r.recommendation === "pending"`, whereas the global helper checks `!r.client_decided`.

## Proposed Changes

### Core Logic
#### `src/lib/client-overview.functions.ts`
- Remove the local `awaitingDecision` helper.
- Update the `decision_queue` filter to use the canonical `isAwaitingClientDecision` helper.
- Ensure `decision_queue_meta.checked` and other counts are consistent with this definition.

### KPI Synchronization
#### `src/lib/client-kpi.server.ts`
- Verify `isAwaitingClientDecision` is exported and used by `computeKpis`. (Already present).

### Data Access
#### `src/lib/client-overview.functions.ts`
- Verify that `loadKpiRows` (which populates the rows used for these counts) correctly includes the `client_decided` property by checking for existence in the `client_decisions` table. (Already present in `loadKpiRows`).

## Verification Plan

### Automated Tests
- Run existing KPI tests: `bunx vitest src/lib/__tests__/client-hiring-health.test.ts`
- Run overview tests if available.

### Manual Verification
1. Open the client dashboard.
2. Verify that the "Hiring is on track" figure for "awaiting your decision" matches the count in the "What needs you" (Waiting on you) section.
3. Verify that both match the "Action required" count on the Candidates page.
4. Shortlist/Review a candidate and verify all tiles update to 0 simultaneously.
