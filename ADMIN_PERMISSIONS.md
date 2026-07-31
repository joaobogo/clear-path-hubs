# Who can do what

Reviewed against the RLS helpers (`is_platform_admin`, `is_platform_staff`,
`is_org_admin`, `is_org_editor`, `is_org_member`, `has_client_permission`) and the
server functions that back each surface.

## Roles

| Role | Where it lives | Meaning |
| --- | --- | --- |
| Platform admin | `user_roles.role = 'admin'` | Full operator. Owns payments, exemptions, deletions, support sessions. |
| Platform staff (operations) | `user_roles.role = 'staff'` | Day-to-day operator: review, scoring, scheduling, notes. No destructive or billing powers. |
| Client admin | `memberships.role = 'admin'` | Owns their organization: team, billing view, all roles. |
| Client editor | `memberships.role = 'editor'` | Works roles and candidates, cannot manage team or billing. |
| Client viewer | `memberships.role = 'viewer'` | Read-only inside their organization. |
| Candidate | authenticated user, no membership | Only their own applications and files. |
| Anonymous | none | Public job board, apply form, status lookup by reference + email. |

## Capability matrix

| Capability | Platform admin | Platform staff | Client admin | Client editor | Client viewer | Candidate |
| --- | --- | --- | --- | --- | --- | --- |
| See every organization | Yes | Yes | No | No | No | No |
| Create / edit a role | Yes | Yes | Yes | Yes | No | No |
| Publish a role (payment gate) | Yes | No | Pay first | Pay first | No | No |
| Mark a role payment-exempt | Yes | No | No | No | No | No |
| Hard delete role or candidate match | Yes | No | No | No | No | No |
| Approve candidate for a client | Yes | Yes | No | No | No | No |
| Release candidate contact details | Yes | Yes | No | No | No | No |
| See approved candidates | Yes | Yes | Yes | Yes | Yes | No |
| Advance / hold / decline a candidate | Yes | Yes | Yes | Yes | No | No |
| Schedule interviews | Yes | Yes | Yes | Yes | No | No |
| Submit interview scorecards | Yes | Yes | Yes | Yes | No | No |
| Manage team and seats | Yes | No | Yes | No | No | No |
| View payments ledger | Yes | Own org only | Own org only | No | No | No |
| Read internal notes | Yes | Yes | No | No | No | No |
| Open a support session on a client workspace | Yes | Yes (read-only) | No | No | No | No |
| Read the audit trail | Yes | Yes | Own org events | No | No | No |
| Download a CV | Yes | Yes | Only when released | Only when released | Only when released | Own CV |
| Update own application / CV | n/a | n/a | n/a | n/a | n/a | Until the role closes |

## Enforcement notes

- Every capability above is enforced in the database via RLS, not only in the UI.
  Client surfaces additionally hide actions the user cannot perform.
- Support sessions are read-only by default; any action taken during one is written
  to `support_actions` with before/after state.
- Candidate visibility to a client is gated by `is_candidate_visible_to_org`; contact
  release is a separate check (`is_candidate_contact_released_to_org`).
- Seat caps (3 recruiters) are enforced on membership insert, not in the UI.
