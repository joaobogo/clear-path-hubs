# Role and tenant isolation proof

Scope: can a client user or a candidate reach staff routes, another
organisation's records, or candidates that have not been approved for them —
by direct URL, by direct Data API query, or by calling a server function?

Verdict: **permission leaks = 0, tenant leaks = 0**, proven server-side.

## How it was proven

Three independent layers, because a pass at one layer does not imply the others.

1. **Data API, as the real user.** Signed in the QA users with the publishable
   key (password grant) and queried PostgREST directly with their bearer token,
   bypassing the app entirely. This is the layer an attacker would use.
2. **Database policy simulation.** `public.run_tenant_isolation_proof()` runs
   169 scenarios under `SET LOCAL ROLE authenticated` with forged
   `request.jwt.claims`, covering every org-scoped table for
   client-admin / client-viewer / candidate against their own and a foreign org.
3. **Server-function guards.** Static coverage over every admin-surface
   `*.functions.ts`, locked by a test.

## 1. Direct Data API results

Users: `qa.clientadmin`, `qa.clientviewer`, `qa.candidate` (all
`is_platform_staff = false`, `is_platform_admin = false`).

Foreign organisation (`QA_OTHERCO_E2E`) and the demo organisation
(`Northwind Talent (Demo)`), counted with `Prefer: count=exact`:

| Table | Own org | Foreign org | Demo org |
| --- | --- | --- | --- |
| candidate_matches | own only | 0 | 0 |
| positions | 2 | 0 | 0 |
| payments | 0 | 0 | 0 |
| interviews | 0 | 0 | 0 |
| score_runs | 0 | 0 | 0 |
| internal_notes | 0 | 0 | 0 |
| audit_events | 0 | 0 | 0 |
| conversations / messages | 0 | 0 | 0 |
| intake_submissions | 0 | 0 | 0 |
| memberships | 3 (own) | 0 | 0 |
| dashboard_requests / grants | 0 | 0 | 0 |
| admin_copilot_* | 0 | 0 | 0 |
| organizations | 1 (own) | — | — |
| user_roles | own row only | — | — |

Unfiltered reads (no `organization_id` filter, i.e. "give me everything") return
the same: `0` on every staff table, `1` profile (their own), own org only.
A candidate sees `0` organizations and exactly `1` `user_roles` row (their own).

Anonymous requests with only the publishable key are rejected with `401 / 42501`
on every table probed — the public job board is served through its own
read path, not through open table grants.

`candidate_matches` additionally has no table-level `SELECT` for
`authenticated` (`awdm` only): clients cannot read the raw match table at all,
only the approved client-facing projections.

## 2. Policy simulation

169/169 scenarios pass. The only cross-tenant rows any non-member can see are
the deliberate public job board carve-out: `positions` with
`visibility = 'public' AND status = 'active'`, plus their locations. Everything
else is `is_org_member()`-gated.

## 3. Server-function and route guards

- `/admin/*` is gated in `beforeLoad` by `getStaffAccess` → `is_platform_staff`
  RPC. Route guards are UX; the checks below are the boundary.
- `src/lib/authz.server.ts` holds the canonical assertions:
  `assertPlatformStaff`, `assertOrgMember`, `assertMatchVisible`,
  `assertContactReleased`.
- Added explicit in-handler staff assertions to the admin copilot
  (`getCopilotState`, `resetCopilot`, `askCopilot`) — previously these relied on
  copilot-table RLS alone, which fails late rather than fast.
- `src/lib/__tests__/admin-surface-authz-coverage.test.ts` fails the build if any
  exported admin-surface server function has no staff guard in its own handler.
  Two functions are listed as exceptions with reasons: `deleteInternalNote`
  (RLS: staff AND author) and `resolveNotification` (scoped to
  `recipient_user_id = caller`) — both are self-scoped, not staff-only data.

## 4. Candidate visibility and contact release are separate gates

- Visibility: a client sees a candidate only through the approved client
  projection; `candidate_matches` itself is unreadable to `authenticated`, and
  `assertMatchVisible` re-checks per request.
- Contact release: `ClientCandidateDTO` carries no email, phone or last name at
  all. CV download/preview is offered only when `contact_released` is true and
  the server re-checks that flag on every download — releasing contact is a
  distinct admin action from approving visibility.

## Re-running

- Policy proof: `select * from public.run_tenant_isolation_proof();`
- Guard coverage: `bunx vitest run src/lib/__tests__/admin-surface-authz-coverage.test.ts`
