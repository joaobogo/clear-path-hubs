# Fix Publish Desk Confirmations and Error Humanization

Address issues B1, B2, B3 in the admin publish desk related to confirmation dialogs, button disabling, and error message mapping.

## User Review Required

> [!IMPORTANT]
> The fix for the error `position_screening_limit_exceeded` assumes this is a custom error message thrown by the server when a limit is reached. I will map this to the human sentence requested.

## Proposed Changes

### Admin UI (PublishGatePanel)
- **Fix B1 (Confirmation Dialog)**: Add a confirmation dialog when clicking "Publish" to name the client and role, using the same pattern as "Grant payment exemption".
- **Fix B2 (Button Disabling)**: Ensure the "Publish" button is disabled if the role is not approved (even if other blockers are cleared).
- **Fix B3 (Error Mapping)**: Update `toastError` logic or create a specific mapping for `position_screening_limit_exceeded` to "This role has reached its screening limit. Raise the limit or archive an existing screening run."

### Error Handling
- Update `src/lib/publish-gate.ts` to humanize common publish errors for staff.
- Modify `src/lib/toast-error.ts` or a new mapping util to handle specific operational error codes like `position_screening_limit_exceeded`.

## Technical Details
- `src/components/admin/publish-gate-panel.tsx`: Add confirmation state/dialog.
- `src/lib/publish-gate.ts`: Add `not_approved` to the disabling condition in the UI (via `can_publish` derivation in the server or direct UI check).
- `src/lib/error-taxonomy.ts`: Add `position_screening_limit_exceeded` to the humanized error mapping.
