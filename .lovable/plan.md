---
title: Resolution of MVP Blockers and UX Refinements
---

# Plan - Resolution of MVP Blockers and UX Refinements

Address the remaining "STILL BROKEN" items from the 49-item audit, focusing on candidate search, global search indexing, approval button functionality, and notification health reporting.

## User Review Required

> [!IMPORTANT]
> - **Search Results**: I am widening the search scope for candidates and organizations. If you still see 0 results for "Northwind" or specific candidates, please verify that these records are not marked as `is_test_record = true` in the database, as they are hidden by default for staff.
> - **Approval Buttons**: I've identified that the "Approve" buttons in the inbox were missing a crucial check for "already published" state, which could make them appear dead if the UI didn't update. I am adding explicit loading states and toast feedback.

## Proposed Changes

### 1. Candidate & Global Search Fixes (B2, B3)
- **Global Search**: Ensure organizations are indexed correctly by removing overly restrictive filters and ensuring `ilikeValue` handles search terms with special characters (commas, etc.) safely.
- **Candidate Registry**: Fix the search returning 0 results by ensuring the `or` filter in `src/lib/admin-candidates.functions.ts` correctly targets the `v_admin_candidate_index` view columns, including a fallback for `search_text` if it's null.

### 2. Admin Workspace UX Refinements (M1, M2, M10, L5)
- **Work Queue Dashboard**: 
    - Fix dead links to `#queue-intakes_aging` and `#queue-score_stale` by ensuring these anchors exist or the tiles are disabled when the count is 0.
    - Make role titles and account names in queue rows interactive links.
    - Standardize queue preview density to a consistent `PREVIEW_LIMIT`.
- **Labels**: Standardize "1m" to "1 min" and "1mo" to "1 mo" for clarity.

### 3. Approvals & Evidence Hygiene (B1, B5, B6, H13)
- **Approvals Inbox**: Bind click handlers correctly and add `useMutation` feedback to prevent the "dead button" perception.
- **Requester Attribution**: Fix "Requested by unknown" by improving the `resolveLastActors` logic to correctly handle client-side actors versus staff actors.
- **Evidence Processing**: Ensure quotes are snapped to sentence boundaries and PII is scrubbed using the established `cleanQuote` and `stripContactLines` logic.

### 4. Notification & Health Monitoring (H6, L3)
- **Delivery Health**: Reconcile counts in the `NotificationsPage` and ensure the `DeliveryFailuresPanel` correctly displays suppressions.
- **Error States**: Clean up "Not found" copy to avoid leaking internal route slugs.

## Technical Details

- **Database**: All search queries against `organizations`, `positions`, and `v_admin_candidate_index` will use `or` with `ilikeValue` for safe partial matching.
- **TanStack Router**: Replace legacy `a` tags with `Link` components in the dashboard to maintain SPA navigation and active state management.
- **Auth**: Ensure `requireStaff` guards are applied to all new server functions.

## Quality Assurance

- **Verification**: I will use Playwright to verify that searching for a known candidate returns results and that clicking a queue row navigates to the correct record.
- **Build**: Run a full typecheck to ensure no regressions in the candidate registry or admin dashboard.
