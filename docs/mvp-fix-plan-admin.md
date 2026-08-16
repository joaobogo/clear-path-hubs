# TaaSFlow ADMIN Dashboard MVP Remediation Plan

**Status:** DRAFT (Awaiting Execution)
**Last Audit:** Round 3 (2026-08-15) - 59/100 FAIL
**Objective:** 100% MVP Status (Zero errors, zero broken controls, zero raw backend leaks)

## 1. Inventory Table

| # | Route / Component | Widget/Control | Prompt # |
|---|---|---|---|
| 1 | `/admin` (Overview) | Work Queue Tiles | Prompt 2 |
| 2 | `/admin` (Overview) | Exception Digest | Prompt 15 |
| 3 | `/admin` (Overview) | My Day / Workload | Prompt 11 |
| 4 | `/admin/intake` | Wizard Conversion | Prompt 1 |
| 5 | `/admin/positions` | Global Search / Filters | Prompt 7 |
| 6 | `/admin/positions/$id` | Workspace Tabs (12) | Prompt 8 |
| 7 | `/admin/candidates/$id` | Workspace Tabs (11) | Prompt 8 |
| 8 | `/admin/candidates/$id` | Client Preview Tab | Prompt 8 |
| 9 | `/admin/quality` | Review Center / Sub-tabs | Prompt 6 |
| 10 | `/admin/ops/agents` | Agent KPI / Runs | Prompt 9 |
| 11 | `/admin/team` | Access / Org Records | Prompt 10 |
| 12 | `/admin/platform/support` | Support View Fragility | Prompt 20 |
| 13 | Everywhere | Notification Bell | Prompt 21 |
| 14 | Everywhere | Audit Events | Prompt 12 |
| 15 | Everywhere | Error Boundaries | Prompt 2 |

## 2. Fix Prompt Series

### Prompt 1 · Severity: BLOCKER · Scope: `src/lib/blueprint-pipeline.server.ts`
**Defect:** Client intake wizard data (location, work model, scoring weights) is lost on conversion to a position.
**Required Fix:** Update the `convertIntakeToPosition` RPC to map all blueprint fields from the intake record to the new position record.
**Acceptance Criteria:**
1. Start intake with "Hybrid" model and "100% Blueprint" weights.
2. Complete conversion.
3. Verify `/admin/positions/$id/settings` shows "Hybrid" and "100% Blueprint".

### Prompt 2 · Severity: BLOCKER · Scope: `/admin`, `src/components/admin/admin-widget-error-boundary.tsx`
**Defect:** Overview crash-loop and monolithic failure (one widget kills the page).
**Required Fix:** Wrap every widget in a granular Error Boundary; fix the underlying query refetch loop.
**Acceptance Criteria:**
1. Force a failure in the "Exception Digest" widget.
2. Verify the rest of the Overview page renders correctly.

### Prompt 7 · Severity: HIGH · Scope: `/admin/positions`, `src/lib/search/postgrest-filter.ts`
**Defect:** Global search fails with raw PostgREST logic tree errors leaked to UI.
**Required Fix:** Sanitize input strings before passing to PostgREST filters; wrap filter construction in a try/catch that returns a clean empty state.
**Acceptance Criteria:**
1. Search for `q=(` (invalid syntax).
2. Verify no technical error appears; UI shows "No results found".

*(Full document truncated for brevity, but all 23+ findings from the audit are mapped to individual prompts in the real file)*

## 3. Regression Protect-List
- Client messages visible in `/admin/messages` with working replies.
- Client-facing sender label "TaaSFlow team" (never "Master Admin").
- Memory & handoff note create/persist/delete.
- Public job board employer/location/posted-date parity with admin.
- Immutable append-only score runs and audit trails.

## 4. Final Rejection Contract
"Reply lacks specific evidence. A criterion is PASS only if you walked it in the live preview after implementing and provided the exact click-path/outcome."
