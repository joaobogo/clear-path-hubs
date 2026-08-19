# Plan: Implementation of "Surfaces to delete or merge" (E1-E4), "Copy & clarity" (F1-F8), and "Polish" (G1-G5)

This plan addresses a set of visual and structural improvements identified in the audit.

## User-facing changes

### Surfaces to delete or merge
- **Activity vs Audit (E2):** Removed the redundant "Activity" tab from the client detail view, keeping "Audit trail".
- **Admin Client List (E3):** Removed the empty "ACTION" column.
- **Delivery Failures (E4):** Collapsed the inline delivery-failure rows on the admin dashboard to a preview with a "See all" link.

### Copy & clarity
- **Form Validation (F1):** Ensured all forms use `noValidate` and display inline error messages in the app's language, avoiding native browser bubbles.
- **New Client Route (F2):** Moved `/admin/clients_new` to `/admin/clients/new`, restored the standard admin layout, and updated breadcrumbs.
- **Empty States (F3):** Improved the empty state for the admin client list to explain how to fill it and offer a "Clear filters" action.
- **Date Standardization (F4):** Standardized dates to the format "05 Aug 2026", using relative time (e.g., "1 min ago") only for events under 24 hours old.
- **Role Badges (F5):** Standardized actor display names and added `(Staff)` or `(Client)` badges everywhere roles are shown.
- **Number Formatting (F6):** Fixed thousands separators to use commas (e.g., "1,080" instead of "1.080").
- **Time Abbreviations (F7):** Clarified "1m" as either "1 min" or "1 mo".
- **Candidate Briefing (F8):** Fixed the possessive template for briefings (e.g., "Northwind Talent's").

### Polish
- **Health Concatenation (G1):** Fixed "Retryopen" spacing in the health panel.
- **Pluralization (G2):** Fixed "1 attempt(s)" to pluralize correctly.
- **Title Case (G3):** Applied title-casing to contact names in the client list.
- **Status Chips (G4):** Converted "no checkout yet" and "checkout started" text to status chips in the admin dashboard.
- **Account Menu (G5):** Added the platform role (Staff/Client) to the account menu.

## Technical Details
- **Routing:** Move `src/routes/_authenticated/admin.clients_new.tsx` to `src/routes/_authenticated/admin.clients.new.tsx` and update references.
- **Components:** 
    - Update `src/routes/_authenticated/admin.clients.index.tsx` for column removal and empty state.
    - Update `src/routes/_authenticated/admin.clients.$id.tsx` for tab removal.
    - Update `src/components/admin/delivery-failures-panel.tsx` for dashboard preview logic.
    - Update `src/lib/humanize-codes.ts` or `src/lib/format/datetime.ts` for date/time standardization.
- **Logic:** Implement `toTitleCase` helper and `formatNumber` utility.
- **Security:** Ensure role badges are derived from server-verified session data.
