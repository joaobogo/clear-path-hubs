# Polish Pass for MVP Launch

This plan addresses a series of medium and low-priority defects identified during the recent audit, focusing on layout, navigation, and logic polish.

## User Review Required

> [!IMPORTANT]
> Some UI changes (M1, M5, M12) involve renaming or removing elements to improve clarity without introducing new features.

- **M1 (Density Toggle):** The density toggle will now correctly apply CSS classes to role cards on the Overview page.
- **M5 (Kanban Drag-and-Drop):** Since drag-and-drop is not implemented, the kanban "affordance" (visual cues for dragging) will be removed to prevent user confusion.
- **M12 (Interview Dialog):** "Cancel" will be renamed to "Cancel interview" to distinguish it from "Close".

## Proposed Changes

### 1. Layout and Navigation Polish
- **M1 (Overview Density):** Wire the density value from `useDensity` to apply reactive CSS classes to role cards in `src/routes/_authenticated/client.index.tsx`.
- **M3 (Candidate Row Links):** Update "Action required" row links in `src/routes/_authenticated/client.candidates.index.tsx` so that "offers awaiting response" points to `?stage=offer` instead of `?filter=interview`.
- **M4 (Table Overlap):** Add bottom padding to the candidate table in `src/components/client/candidates/compact-list.tsx` to prevent the fixed "N selected" bar from overlapping the last row.
- **P3 (Duplicate Search):** Remove the redundant "Open global search" button in the header in `src/components/workspace/workspace-shell.tsx`.
- **L7 (404 Page):** Remove the parenthetical route slug leak from the 404 error page.

### 2. Interview and Scheduling Logic
- **M11 (Interview Bucketing):** Update `isPastItem` logic in `src/lib/interview-timing.ts` to bucket cancelled future interviews under "Already happened" based on their terminal status rather than just the scheduled date.
- **M10 (Interview Status):** Add a "Times sent — awaiting reply" state to the interview chip logic in `src/lib/interview-timing.ts` for when times have been proposed but not yet confirmed.
- **M9 (Interview Validation):** Add validation for the "Candidate" field in `src/components/client/interviews/request-interview-dialog.tsx`.
- **M12 (Dialog Renaming):** Rename "Cancel" to "Cancel interview" in `src/components/client/interviews/interview-detail-dialog.tsx`.

### 3. Candidate Detail and Consistency
- **M19 (Work Auth Redundancy):** Unify "Work authorization" rendering in `src/components/client/candidate-detail/profile.tsx` to use a single field and value across panels.
- **M18 (Talent Memory):** Implement the "Remove tag" path and reflect the current "Silver medalist" state in `src/components/client/candidate-detail/activity.tsx`.
- **P1 (Evidence Naming):** Use full names for evidence providers in `src/components/client/candidate-detail/evidence.tsx` (e.g., "Sofia Marques" instead of "Sofia").
- **P4 (Stage Actions):** Deduplicate stage-action toolbars in `src/routes/_authenticated/client.candidates.$id.tsx` by keeping only one canonical set.

### 4. Admin and Workspace Polish
- **M13 (Confirm Deletion):** Add a confirmation dialog for row deletion in `src/components/client/approvals/approval-row.tsx`.
- **M15 (Notification Labels):** Correct the default label for "Weekly summary" in `src/lib/client-notification-prefs.ts`.
- **P2 (Workspace Header):** Add the workspace name (e.g., "Northwind Talent (Demo)") to the account menu header in `src/components/workspace/workspace-shell.tsx`.
- **L8 (Talent Memory Meta):** Humanize the "consent: pending" string to "Consent pending" in `src/routes/_authenticated/client.talent-memory.tsx`.

## Technical Details
- **M1:** Add `data-density={density}` to the role cards container and define corresponding Tailwind/CSS rules for `compact` vs `comfortable` spacing.
- **M11:** Modify `interviewOccurrence` in `src/lib/interview-timing.ts` to check `status === 'cancelled'` before date comparisons.
- **M13:** Wrap the delete action in `useConfirmAction`.
- **M18:** Add `untagSilverMedalist` server function and wire it to the activity card.
- **P2:** Pull the active workspace name from `useClientOrg` or the context query.
- **L10:** Use a `Set` to deduplicate "City, Region, Country" strings before rendering.
- **M17:** Update `RoleStoryPanel` and `RequirementRowView` to draw bar widths from actual `quoted_count` and add text status labels.

## Verification Plan

### Automated Tests
- Run `vitest` on `src/lib/interview-timing.test.ts` (after creating/updating it) to verify bucketing logic.
- Run `vitest` on `src/lib/client-candidate-list-filter.test.ts` to verify M3 link behavior.

### Manual Verification
- **Role Cards:** Toggle density in the Overview page and verify role cards change height/spacing.
- **Interviews:** Propose times for a candidate and verify the chip updates to "Times sent". Cancel a future interview and verify it moves to the "Already happened" section.
- **Approvals:** Click "Delete" on an approval row and verify a confirmation dialog appears.
- **Search:** Confirm only one search button exists in the header.
- **Candidate Detail:** Verify "Work authorization" is only rendered once. Check that evidence provider names are full names.
- **Global search:** confirming "Northwind" returns the organization in results.
