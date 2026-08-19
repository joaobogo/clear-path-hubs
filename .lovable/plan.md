# Fixing Unguarded Destructive Actions, Dead Controls, and Broken Routes

Address a series of high-priority UI and UX defects in the admin workspace identified in the audit (A1-B9).

## Proposed Changes

### 1. Unguarded Actions (A1-A2)
- **Publish Readiness (A1):** Update `src/components/admin/publish-gate-panel.tsx` to disable the Publish button if `not_approved` blockers exist.
- **Unpublish Capability (A2):** Add a dedicated "Unpublish" button with a confirmation dialog to the candidate match visibility controls.

### 2. Dead Controls & Broken Routes (B1-B9)
- **Admin Approvals (B1):** Wire up the Approve/Decline buttons in the Work Queue to their respective mutations.
- **Candidate Search (B2):** Fix the candidate search handler in `src/lib/admin-candidates.functions.ts` by ensuring it uses the sanitized and quoted PostgREST filter helpers.
- **Candidate Tab Navigation (B3/B8):** Fix the "swallowed first click" and dead tab navigation in `src/routes/_authenticated/admin.candidates.$id.tsx` by ensuring the `Link` components or click handlers are correctly mounted and focused.
- **Global Search Index (B4):** Add organizations/clients to the global search index in `src/lib/global-search.functions.ts`.
- **Interviews Route (B6):** Remove broken links to `/admin/interviews` from the notification bell since the route 404s.
- **Zero-count Tiles (B7):** Disable or hide tiles with count 0 in `src/routes/_authenticated/admin.index.tsx` to prevent navigation to empty anchors.
- **Queue Row Linking (B9):** Ensure all titles and account names in `src/components/admin/work-queue-row.tsx` are rendered as `Link` components.

## Technical Details
- Use `ilikeValue` and `orIlike` from `src/lib/search/postgrest-filter.ts` for all ILIKE queries to prevent injection and syntax errors.
- Standardize on TanStack Router `Link` for all internal navigation to maintain state and avoid page reloads.
- Ensure all destructive actions (Delete, Archive, Publish, Unpublish) use `AlertDialog` for confirmation.
