# Plan - Fix "Numbers that lie" (C1-C10)

Reconcile metrics and counts across admin and client consoles to ensure accuracy and consistency.

## User Review Required

> [!IMPORTANT]
> No critical user decisions are required. I am unifying existing metrics following the "Honesty Gate" principle (verified evidence only).

## Proposed Changes

### Client Detail & KPI Tiles
- **C1:** Reconcile visual duplicate KPI tiles in `src/routes/_authenticated/admin.clients.$id.tsx`. Row B was already logically removed; I'll ensure the UI is clean and points to the unified `AccountOperatingSummary`.
- **C10:** Reconcile "Documents" tab counts. Point the label at the same `parsed_cv_count` field used in the overview.

### Evidence & Coverage
- **C2/C3:** Fix "N of N must-have criteria evidenced" and graph buckets in `src/lib/evidence/evidence-graph.ts`. Count only requirements with actual `sources` (verified quotes) as evidenced/verified.
- **C9:** Unified evidence coverage calculation. Apply the "Honesty Gate" (verified evidence required for 100% score) to `src/lib/client-fit-presentation.ts`, ensuring it matches the admin's detailed view.

### Admin Organization List
- **C4:** Widen `listClients` in `src/lib/admin.functions.ts` to include all organizations with active positions, even if archived or uncategorized.
- **C5:** Derive "7 active · 6 archived" counts directly from the table's own filtered query result in `listClients`.

### Publish Readiness & Hires
- **C6:** Fix "ready" predicate in `src/components/admin/publish-gate-panel.tsx`. Explicitly include approval state in the "ready" badge count to match button logic.
- **C7:** Correct Hire counts in `src/lib/admin-account-view.server.ts` by including positions with status 'filled' and ensuring active positions include those with 'active' status.

### Operations & Jobs
- **C8:** Reconcile "Failed jobs" counts between digest, operations, and health views. Unify the query in `src/lib/admin.functions.ts` to include both 'failed' and 'stuck_queued' statuses and increase the lookback/limit.

## Technical Details
- Standardizing status checks: `(ACCOUNT_OPEN_POSITION_STATUSES as readonly string[]).includes(p.status) || p.status === 'active'`.
- "Honesty Gate" implementation: `(r: RequirementRow) => r.status === 'met' && r.evidence.length > 0`.
- Query unification: Using `.in('status', ['failed', 'stuck_queued'])` for all job health rollups.

## Verification Plan

### Automated Tests
- Run `lovable-exec test` to ensure no regressions in server functions.
- Verify Zod schema changes in `listClients`.

### Manual Verification
- Check `/admin/clients` for consistent counts.
- Check Candidate Evidence tab for reconciled graph buckets (Verified vs No Evidence).
- Check Admin Operations dashboard for consistent Failed Jobs counts.
