# Repair Actions

Every repair uses a canonical server function under `src/lib/support.functions.ts` (to author), gated by `requireSupabaseAuth` + role check, and writes a `support_actions` row inside the same transaction as the state change. Direct Supabase writes from the Admin UI are forbidden (see `docs/product/contracts.md` §mutations).

| Action                     | Server fn                       | Permitted by            | What it does                                                                                                 | Audit action                    |
| -------------------------- | ------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Resend invitation          | `resendInvitation`              | platform_admin, ops     | Calls Auth Admin `inviteUserByEmail`; updates `memberships.status`.                                          | `resend_invitation`             |
| Unlock account             | `unlockAccount`                 | platform_admin, ops     | Clears Auth Admin `banned_until`; toggles `profiles.status = 'active'`.                                      | `unlock_account`                |
| Correct membership         | `correctMembership`             | platform_admin, ops, client_admin *(own org)* | Updates role/status on a single row; validates against `membership_role` enum.               | `correct_membership`            |
| Restore removed member     | `restoreMember`                 | platform_admin, ops     | Re-activates a `status='removed'` membership within retention window (90 d).                                 | `restore_member`                |
| Deactivate user            | `deactivateUser`                | platform_admin          | Sets `profiles.status='disabled'`, invalidates all sessions, marks memberships inactive.                     | `deactivate_user`               |
| Invalidate sessions        | `invalidateAllSessions`         | platform_admin, ops     | Auth Admin `signOut(user_id, 'global')`.                                                                     | `invalidate_sessions`           |
| Repair org membership      | `repairOrgMembership`           | platform_admin, ops     | Recreates a missing `memberships` row for an existing profile (e.g. after failed intake); uses `is_org_admin` invariant check. | `repair_org_membership`         |

**Contract per action.**
- Every fn signature: `{ reason: string, targetUserId: uuid, [payload] }` — reason is required, stored in `support_actions.reason`.
- Every fn wraps its mutation in `withCanonicalAudit(action, target)` which snapshots `before_state` / `after_state` jsonb.
- Every fn returns `{ traceId }` so the UI can show "Done — reference `sup_XXXX`".
- Idempotency: reruns within 60 s with same `(action, target_user_id, reason)` short-circuit and return the prior `traceId`.

**Blocked today.** Implementation of these fns is deferred until Phase 17 P1 (auth redirect) unblocks — without a working signed-in surface, repairs cannot be exercised end-to-end.
