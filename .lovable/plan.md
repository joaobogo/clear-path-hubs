# Plan: Reconcile "Include Archived" and Test Record Filtering in Admin Client List

Investigate and fix the discrepancy where the `/admin/clients` list misses several organizations even when "Include archived" is checked. The missing organizations are flagged as test/internal records (`is_test_record = true`) and are being excluded by the global test-record scoping mechanism, which operates independently of the "archived" filter.

## Proposed Changes

### 1. Fix Client-Side Filtering in `/admin/clients`
Standardize the row filtering logic in `src/routes/_authenticated/admin.clients.index.tsx` to ensure that when a specific search term is provided, the implicit exclusion of archived records is lifted.

- Update `useMemo` filter for `archived` to correctly respect the search term and the checkbox.
- Ensure the "Include archived" toggle is clearly labeled as including *archived* records, while the global toggle (top bar) continues to control *test* records.

### 2. Verify and Adjust `listClients` Server Function
Ensure `src/lib/admin.functions.ts` fetches a wide enough dataset to allow correct client-side filtering, or move the `is_test_record` logic further upstream if needed.

- Re-examine `listClients` in `src/lib/admin.functions.ts` (currently missing/truncated in view) to ensure it correctly respects the `include_test` input from `useIncludeTestRecords()`.
- Confirm that the `limit(2000)` is sufficient or if it needs to be increased/paginated to avoid dropping records.

### 3. Clear Feedback on "Hidden" Records
Enhance the empty state or footer to inform the admin why they might see fewer results than expected due to the global test-record toggle.

- Use `TestScopeEmptyNote` in the empty state of the clients table.
- Add a status indicator if test records are hidden and organizations matching the search are available but excluded.

## Technical Details
- The organizations `CB Test Company`, `Rehearsal Hotels Ltd`, `Rehearsal Hotels 489631`, and `neuronflow` are flagged with `is_test_record = true`.
- Global scoping is controlled by `profiles.show_test_records` (mirrored in `taasflow_show_test` cookie) and resolved via `src/lib/admin-test-scope.server.ts`.
- `useIncludeTestRecords()` in `src/routes/_authenticated/admin.clients.index.tsx` correctly reads this state.

## Verification Plan
### Manual Verification
1. Navigate to `/admin/clients`.
2. Turn ON "Test records shown" in the top bar.
3. Check "Include archived" in the filter bar.
4. Verify all 15 organizations (including the 4 mentioned) are listed.
5. Search for "neuronflow" with test records hidden; verify it doesn't appear.
6. Search for "neuronflow" with test records shown; verify it appears.
