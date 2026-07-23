# Client Settings Finalization — Certification

**Scope:** `/client/settings` for Client Admin, Editor, and Viewer roles.
**Verdict: PASS** — nonfunctional settings = 0, false saved states = 0.

## Surfaces audited

| Section | Reader | Writer | Backend effect |
|---|---|---|---|
| Company profile (name, website, industry, HQ, phone) | `getClientSettings` → `organizations` | `updateClientCompanyProfile` → `organizations` UPDATE | ✅ persists + audit `client.settings.company_profile.update` |
| Timezone | `profiles.timezone` | `updateClientTimezone` → `profiles` UPDATE | ✅ persists + audit `client.settings.timezone.update` |
| Communication / candidate / interview / message / offer / hire notifications + digest cadence + email toggle | `client_notification_preferences` row (upserted per user+org) | `updateClientNotificationPreferences` upsert | ✅ persists + audit `client.settings.notifications.update` |
| Security | Password reset via Supabase email link; session revoke via sign-out | Deep-link to `/auth/reset` | ✅ real Supabase action, no local no-op |
| Account | Display name / email read-only (identity source of truth = auth) | Support contact link | ✅ read-only surface — no false save button |

## Removed / never surfaced

- No SMS/WhatsApp toggles (no delivery backend) — kept out of DTO.
- No "compact mode" / "beta features" placeholders — never shipped.
- No org-level notification defaults control — pref rows are per user+org by design.

## Role gating (enforced server-side, not just UI)

- `updateClientCompanyProfile` → `assertOrgAdmin` (client_admin or platform staff only). Editor/Viewer receive `Forbidden`.
- `updateClientNotificationPreferences` and `updateClientTimezone` → any active member except `client_viewer`; viewer receives `Read-only role`.
- Every writer calls `assertNotSupportViewReadOnly` — Admin View-as-Client cannot mutate settings.

## Failed save + rollback

Verified via forced-error injection (invalid domain + Supabase returning error):
1. Form shows toast "Save failed", inputs remain dirty, no cached success state.
2. React Query mutation `onError` does not touch cache; next `getClientSettings` refetch returns pre-edit row from DB.
3. No audit row written (audit is inside handler after successful UPDATE; verified `audit_events` has zero rows for failed attempt).

## Evidence

- `src/lib/client.functions.ts:1270-1490` — read + three writers, each with role gate + support-view guard + audit.
- `src/routes/_authenticated/client.settings.tsx` — every input bound to one of the three writers; viewer sees `disabled` inputs + "Read-only role" banner.
- Zero UI controls dispatch without hitting a server fn.

**Nonfunctional settings: 0. False saved states: 0. Verdict: PASS.**
