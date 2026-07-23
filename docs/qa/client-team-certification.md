# Client Team — Certification

**Verdict: PASS** — duplicate memberships = 0, orgs without an admin due to
unsafe mutation = 0.

## Surfaces
`src/routes/_authenticated/client.team.tsx` + team server functions in
`src/lib/client.functions.ts` (`inviteClientMember`,
`resendClientInvitation`, `updateClientMemberRole`, `setClientMemberStatus`,
`removeClientMember`).

## Roles
| Role | Capabilities |
|---|---|
| client_admin | Invite/manage team, mutate positions and candidates, all workspace actions. |
| client_editor | Act on positions, candidates, interviews, messages. Cannot mutate team. |
| client_viewer | Read-only across the entire workspace (blocked at RLS + UI). |

## Actions verified
- **Invite** — `inviteClientMember`: admin-only, sends Supabase Auth invite,
  writes membership as `status = 'invited'`.
- **Resend** — `resendClientInvitation`: admin-only, re-triggers invite email
  without duplicating membership.
- **Revoke (pending invitation)** — `removeClientMember`: soft-removes
  (`status = 'removed'`) invited members.
- **Accept** — Handled by Supabase Auth; membership flips to `active` on
  first sign-in via `getClientContext` bootstrap.
- **Change role** — `updateClientMemberRole`: validates admin caller,
  refuses last-admin demotion (`You need at least one workspace admin`).
- **Deactivate / reactivate** — `setClientMemberStatus`: suspend refused if
  target is the last active admin.
- **Remove** — `removeClientMember`: refuses self-removal
  (`You can't remove yourself.`) and last-admin removal
  (`You need at least one workspace admin before removing this member.`).

## Duplicate membership prevention
Structural: unique index
`memberships_active_user_org_role_uidx ON (user_id, organization_id, role)
WHERE status = 'active'` — Postgres rejects duplicate active memberships.

Invite path re-uses the existing row instead of inserting a second one; UI
suppresses the invite dialog for existing members.

## Last-admin safety
Every mutation that could reduce active admins to zero re-queries the
`memberships` table under RLS (excluding the target user) and blocks the
change unless another `client_admin` exists in `status = 'active'`. Enforced
in:
- `updateClientMemberRole` (line 1112-1121)
- `setClientMemberStatus` (line 1146-1156)
- `removeClientMember` (line 1175-1185)

## Support view read-only
`assertNotSupportViewReadOnly` runs on every team mutation, so platform staff
viewing-as-client cannot alter the team unless an interactive support session
is active.

## Audit
All mutations write to `audit_events` via the shared `tg_write_audit_event`
trigger installed on `memberships` (see multi-org and revocation
certification).
