# Runbook 13 — User Access Issue

**Symptoms**
- User cannot sign in / does not see expected surfaces / stuck at `/auth`.

**Diagnosis**
1. `SELECT status, last_sign_in_at FROM profiles WHERE lower(email)=lower($email);`
2. `SELECT organization_id, role, status FROM memberships WHERE user_id=$1;`
3. `SELECT * FROM user_roles WHERE user_id=$1;`
4. Auth Admin: `banned_until` set?

**Safe action** (see `docs/support/repair-actions.md`)
- Locked → `unlockAccount(userId, reason)`.
- Missing membership → `repairOrgMembership(userId, orgId, role, reason)`.
- No invitation received → `resendInvitation(email, orgId, role, reason)`.
- Role wrong → `correctMembership(membershipId, newRole, reason)`.
- Sessions stale → `invalidateAllSessions(userId, reason)` — user re-signs in cleanly.
- Sensitive: platform-wide disable → `deactivateUser(userId, reason)` (platform_admin only).

**Expected result**
- User signs in and reaches expected surface.

**Escalation**
- Auth SSO/IdP issue → Level 3.

**Rollback**
- `restoreMember`, `reactivateUser`; all repairs are canonical and reversible.

**Audit**
- Every action lands in `support_actions` with reason; view-as sessions (if used) captured in `support_sessions`.
