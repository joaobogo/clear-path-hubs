# View-as-User Design

## Flow

1. Staff opens `/admin/support/users/$userId` and clicks **View as user**.
2. Modal requires:
   - **Reason** (min 10 chars, free text — indexed for search).
   - **Ticket reference** (optional, e.g. Linear/Zendesk ID).
   - **Duration** (5 / 15 / 30 min — hard cap 30 min at DB level).
   - **Scope**: `read_only` (default) or `elevated` (platform_admin only, requires re-auth).
3. Server fn `startSupportSession` (canonical, `requireSupabaseAuth`):
   - Verifies actor is `platform_admin` or `operations` (via `has_role`).
   - Rejects target = self, target = platform_admin when actor = operations (also DB-enforced).
   - Rejects any second active session for the same actor (unique partial index by convention: end existing session first).
   - Generates `trace_id` (`sup_<ULID>`), inserts `support_sessions` row, inserts `support_actions('view_as_start')`, emits `notification_events` to target user's mailbox: **"A platform administrator viewed your account for support (ref sup_XXXX)"**.
4. Sets an encrypted, HTTP-only cookie `x-taasflow-support` = `{sessionId, expiresAt}` (TanStack `useSession`, 30-day rolling `password` from `SUPPORT_SESSION_SECRET`).
5. All authenticated server fns read this cookie in a `withSupportContext` middleware:
   - If present + not expired + row exists + not ended → override `context.userId` (read-only surfaces only) with target user, and set `context.supportActive = true`.
   - Every mutation checks `context.supportActive`: if true and `scope='read_only'`, the mutation throws `SupportReadOnlyError`; if `scope='elevated'`, an entry is appended to `support_actions` in the same transaction as the mutation (via canonical writer wrapper).
6. Banner component `<SupportBanner />` renders sitewide when `supportActive`:
   - Red bar, target user + org name, reason, countdown to expiry, **Exit support session** button.
   - `<html data-support="active">` attribute so E2E tests can assert visibility.

## Exit

- Manual: **Exit** button calls `endSupportSession` → sets `ended_at = now()`, `end_reason = 'user_exit'`, clears cookie, emits `view_as_end` action.
- Automatic: cookie or DB `expires_at` past → middleware treats as ended, clears cookie, emits `view_as_end` with `end_reason='expired'` (idempotent).
- Force revoke: another platform_admin can call `revokeSupportSession(id, reason)` → `end_reason='revoked'`.

## Guarantees

| Requirement                       | Enforced by |
| --------------------------------- | ----------- |
| Explicit reason                   | Zod `min(10)` + DB `CHECK` |
| Time-limited (≤ 30 min)           | DB `CHECK expires_at <= started_at + interval '30 minutes'` |
| Visible banner                    | Middleware sets `supportActive`, root layout renders `<SupportBanner />`; catalogue test screenshots it |
| No password access                | No code path reads `auth.users.encrypted_password`; recovery uses `generateLink` |
| Audit event                       | `support_actions('view_as_start')` + `audit_events` row (existing `tg_write_audit_event`) |
| No silent impersonation           | Target user gets in-app notification; entry always logged |
| Read-only by default              | `SupportReadOnlyError` on mutation writers when `scope='read_only'` |
| Sensitive actions separately authorized | `scope='elevated'` requires re-auth + platform_admin |
| Exit control                      | Cookie clearable + server-side `ended_at` |
| Ops cannot impersonate platform_admin | App check + `tg_support_session_guard` trigger |
