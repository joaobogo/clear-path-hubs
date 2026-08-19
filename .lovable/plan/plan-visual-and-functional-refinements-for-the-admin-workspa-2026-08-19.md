# Plan: Visual and functional refinements for the Admin Workspace

Refining the TaaSFlow admin experience by fixing broken links, improving UI density, standardizing formatting, and resolving navigation and display bugs.

## Technical Details

- **Admin Queues**: Fixing broken anchor links in `src/lib/admin-ops.server.ts` and improving linkability in `src/components/admin/work-queue-row.tsx`.
- **UI Density**: Capping queue preview lengths and improving the layout of `/admin/clients_new`.
- **State Management**: Binding ARIA states to open/expanded status for dropdowns and dialogs.
- **Data Reconciliation**: Consolidating Activity/Audit tabs and fixing candidate document counts.
- **Formatting**: Standardizing date formats (ISO vs Local), thousands separators, and relative time labels.
- **Safety & Clarity**: Adding confirmation guards for destructive actions (e.g., client archiving) and clarifying ambiguous labels (e.g., "1m" vs "1 min").
- **Persona/Role Logic**: Ensuring consistent staff/client badges and display names.

## Implementation Steps

### 1. Admin Dashboard & Queues (M1, M2, M10, L5, L6, P1)
- [ ] **M1 (Dashboard Links)**: In `src/lib/admin-ops.server.ts`, fix the `see_all.to` paths for `intakes_aging` and `score_stale` to point to valid routes (likely `/admin/intake` and `/admin/scoring/review`) instead of non-existent anchors.
- [ ] **M2 (Queue Links)**: Update `src/components/admin/work-queue-row.tsx` to ensure role titles and account names are interactive links using `RefLabel`.
- [ ] **M10 (Queue Density)**: Ensure all queue sections in `src/lib/admin-ops.server.ts` use `.limit(8)` or a consistent preview length.
- [ ] **L5 (Waiting Labels)**: Update `waited` helper in `src/components/admin/work-queue-row.tsx` to use unambiguous units: "1 min" / "1 mo" / "1h" / "1d".
- [ ] **L6 (Actor Attribution)**: Standardize persona display names and staff/client badges using `resolveStaffPersona`.
- [ ] **P1 (Unpaid Status)**: Change "no checkout yet" / "checkout started" to status chips in `src/components/admin/work-queue-row.tsx`.

### 2. Client & Candidate Detail (M5, M6, L4, L8)
- [ ] **M5 (Activity/Audit Unification)**: In `src/routes/_authenticated/admin.candidates.$id.tsx` and `src/components/admin/candidate-detail/tabs.tsx`, consolidate the "Activity & audit" tab by removing the redundant version.
- [ ] **M6 (Document Counts)**: Reconcile "PARSED: 20" vs "0 documents" labels in the documents tab.
- [ ] **L4 (Thousands Separator)**: Update pagination logic to use English separators (e.g., `1,080`).
- [ ] **L8 (Pitch Grammar)**: Fix the possessive template in `CvTab` pitch summaries (e.g., "Northwind Talent's").

### 3. Registry & Forms (M3, M4, M7, M8, M9, M11)
- [ ] **M3/M4 (Trigger State)**: Fix `aria-expanded` and first-click issues for dropdowns/popovers in `admin.clients.index.tsx` and `payment-exemption-dialog.tsx`.
- [ ] **M7 (Action Column)**: Remove or populate the empty "ACTION" column in the client registry.
- [ ] **M8 (Empty State)**: Improve the "No clients match these filters" display with a "Clear filters" button.
- [ ] **M9 (URL Persistence)**: Ensure filters in `admin.clients.index.tsx` are correctly synced to the URL query string.
- [ ] **M11 (New Client Chrome)**: Restore the admin sub-navigation bar in `admin.clients_new.tsx`.

### 4. Visual & Global Pass (L1, L2, L3, L7, P2, P3)
- [ ] **L1/L2 (Health Labels)**: Fix "Retryopen" spacing and pluralization in `OperationalHealthPanel.tsx`.
- [ ] **L3 (404 Slugs)**: Remove raw slugs from the Not Found component.
- [ ] **L7 (Date Inputs)**: Set `type="date"` inputs to follow the English locale.
- [ ] **P2 (Casing)**: Title-case organization and contact names on render.
- [ ] **P3 (Date Consistency)**: Standardize all dates to `dd/mm/yyyy, HH:mm` format using `APP_LOCALE` and `WORKSPACE_TIMEZONE`.
