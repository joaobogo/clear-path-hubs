# Plan: Enforce Hard Support Session TTL

Enforce a hard 30-minute time-to-live (TTL) for support sessions. Currently, sessions can remain "active" in the audit log for over 24 hours because expiry logic is lazy. We will shift to proactive server-side enforcement and a background sweep for audit accuracy.

## User Review Required

> [!IMPORTANT]
> This change introduces a `pg_cron` job to sweep expired sessions every minute. This ensures audit logs are accurate even for abandoned sessions.

## Proposed Changes

### Database (Supabase)
- Add a `pg_cron` job to run `sweep_expired_support_sessions()` every minute.
- Implement the `sweep_expired_support_sessions()` PL/pgSQL function to mark sessions as `ended_at = now()` and `end_reason = 'expired'` when `expires_at < now()`.

### Backend (TanStack Start)
- **Global Middleware**: Inject a support session check in `requireSupabaseAuth` or a dedicated middleware to reject requests if the session is expired.
- **Workspace Access**: Update `assertNotSupportViewReadOnly` in `src/lib/client-shared.server.ts` to strictly enforce the TTL, ensuring expired sessions immediately lose data access.
- **Audit Logic**: Refine `sweepExpiredSupportSessions` in `src/lib/support-audit.server.ts` to be used as a fallback if the DB sweep hasn't fired yet.

### Verification Plan
- **Automated Tests**: Add a test case in the QA seed/check that simulates an expired session and asserts that workspace reads are rejected.
- **Manual Verification**: Start a support session, wait 31 minutes, and verify:
  1. The session is marked as `expired` in the admin audit log.
  2. The `/client` workspace returns an authorization error (or redirects) for that staff member.
