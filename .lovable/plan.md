# Plan: Fix Candidate Selection Persistence

Fix the candidate selection behavior in the client workspace where the "N selected" banner persists incorrectly after page reloads, even after being cleared.

## Proposed Changes

### 1. Persistence Logic
- Create `src/lib/client-compare-store.ts` using the `store` package to manage candidate selections.
- Scope selections by `organization_id` to prevent candidate leaking between tenants.

### 2. Candidate List Integration
- Modify `src/routes/_authenticated/client.candidates.index.tsx` to:
    - Seed the initial selection from `?compare=` URL params (highest priority) or local storage.
    - Synchronize state to local storage whenever `compareIds` change.
    - Harden the `seededDefault` logic to prevent it from overwriting intentional selections or clears.
    - Provide a stable `toggleCompare` callback that respects the maximum selection limit (4).
    - Provide a `clearCompare` callback that purges both state and storage.

### 3. UI Consistency
- Ensure `CompactList` (table) and `CandidateCard` (grid/mobile) checkboxes reflect the persisted state.
- Update `CompareTray` (the floating banner) to use the new `clearCompare` logic, ensuring reloads after clearing don't resurrect the selection.

## Technical Details

- **Storage Strategy**: `store.js` for robust cross-browser local storage support.
- **Max Selection**: Enforced at 4 candidates (business rule for side-by-side comparison).
- **Tenant Isolation**: Key storage by `orgId` ensures a user switching organizations doesn't see candidates from a different company in their tray.

## Verification Plan

- **Automated**: Playwright E2E test (`verify_fix.py`):
    1. Select 2 candidates → Reload → Verify they are still checked.
    2. Click "Clear" → Reload → Verify the banner is gone and nothing is checked.
- **Manual**: Verify selecting candidates and clearing works as expected in the live preview.
