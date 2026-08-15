# Plan: Staff Account Settings Implementation

Implement account management controls (Display Name, Password Change, Global Sign Out) for staff users at `/me/settings`, ensuring full parity with the admin settings registry and audit logging.

## User Review Required

> [!IMPORTANT]
> The "Password Change" feature for staff will be implemented using Supabase Auth's `resetPasswordForEmail` flow, directing users to their email to complete the change securely, which matches the existing candidate flow.

## Proposed Changes

### 1. Server-Side Logic
- **`src/lib/auth.functions.ts`**:
    - Add `updateStaffProfile` server function to handle `full_name` updates for staff/clients.
    - Implement audit logging for these profile changes using the `audit_events` table.
    - Ensure strict `requireSupabaseAuth` middleware usage.

### 2. Frontend Components
- **`src/components/account/password-change-card.tsx`**:
    - Create a new reusable component to trigger a password reset email via Supabase Auth.
- **`src/components/account/global-sign-out-card.tsx`**:
    - Create a new reusable component for "Sign out everywhere" functionality using `supabase.auth.signOut({ scope: 'global' })`.

### 3. Route & UI Refinement
- **`src/routes/_authenticated/me.settings.tsx`**:
    - Remove the hard block/redirect for staff users.
    - Implement conditional rendering to show account management cards (Name, Email, Password, Global Sign Out) for staff and client users.
    - Retain existing candidate-specific "Privacy & Data" settings only for candidates.
- **`src/routes/_authenticated/me.profile.tsx`**:
    - Ensure name updates for non-candidates work correctly via the new `updateStaffProfile` function.

### 4. Verification & Audit
- Update the admin settings registry in `src/routes/_authenticated/admin.settings.tsx` if needed to confirm full functionality.
- Verify `audit_events` generation for profile updates.

## Technical Details

### Security
- Profile updates use `supabaseAdmin` in server functions to ensure RLS-bypassing verified writes for staff who might not have direct RLS permissions on their own profile row.
- Sign-out and Password reset use client-side Supabase SDK methods for direct session management.

### Audit Payload
```json
{
  "action": "profile.update",
  "entity_type": "profiles",
  "entity_id": "user-uuid",
  "before_state": { "full_name": "Old Name" },
  "after_state": { "full_name": "Admin QA-CHECK" }
}
```
