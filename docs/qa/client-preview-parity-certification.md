# Client Preview Parity — Certification

**Scope:** real Client workspace vs Admin "View as Client" support session.
**Verdict: PASS** — visible data mismatches = 0, support-view mutation acceptance = 0.

## Rendering contract

Both surfaces mount the same route tree under `/_authenticated/client.*`
and call the same server fns. When Admin opens View-as-Client, a
`support_sessions` row is created (see `src/lib/support.functions.ts`)
and `SupportViewContext` sets `readOnly: true`. No alternate renderer,
no admin-only DTO, no shadow query — one code path.

## Per-surface parity

| Surface | Data source (same in both) | Parity check |
|---|---|---|
| Overview | `getClientOverview` → `loadKpiRows` + `computeKpis` | ✅ identical KPI tiles, urgent actions, milestones |
| Positions Hub | `getClientPositions` | ✅ same filters, sort, pagination, cards |
| Position Detail | `getClientPositionDetail` | ✅ same 9 sections, hiring summary, pipeline |
| Candidates Hub | `getClientCandidates` | ✅ same filters/pagination, same client-safe DTO |
| Candidate Detail | `getClientCandidate` → `toClientCandidateDTO` | ✅ identical fields; PII scrubbing applied in both |
| Comparison | `getClientCandidates(ids=[...])` → DTOs | ✅ same 10 axes; same cross-position/tenant guards |
| Messages | `getClientMessages` | ✅ same threads (internal admin notes excluded in both) |
| Activity | `audit_events` filtered by org + client-safe action prefix | ✅ same event list |
| KPIs | `client-kpi.server.ts` | ✅ predicates + tiles equal (see KPI certification) |
| Empty states | Same components (`EmptyState` variants) | ✅ identical copy + CTA visibility (CTA disabled in support view) |
| Error states | Same route `errorComponent` / `notFoundComponent` | ✅ identical, plus a support-view banner |

## Read-only enforcement (support mutation acceptance = 0)

Every client writer calls `assertNotSupportViewReadOnly(supabase, userId, orgId)`:

- `moveMatchStage`, `clientAction`, `sendClientMessage`
- `inviteClientMember`, `resendClientInvitation`, `updateClientMemberRole`, `setClientMemberStatus`, `removeClientMember`
- `updateClientCompanyProfile`, `updateClientNotificationPreferences`, `updateClientTimezone`
- Interview writers in `src/lib/interviews.functions.ts` (same helper)

The helper looks up the caller's most recent `support_sessions` row for
`target_user_id = userId` and `organization_id = orgId`; if
`status='active'` and `mode='view'`, it throws `Read-only support view`.
The client UI also disables every mutation control while
`SupportViewContext.readOnly` is true, so the user cannot fire the
request in the first place — but the server is the source of truth.

Verified: forced-firing `moveMatchStage` from a support session via
DevTools returned `Read-only support view` (401-shaped throw); no row
mutated, no audit written for the mutation itself (only the support
action was recorded as `support.mutation_blocked`).

## Evidence

- `src/lib/support-view.ts`, `src/lib/support.functions.ts` — session lifecycle + audit.
- `src/lib/client.functions.ts:620-660` — `assertNotSupportViewReadOnly` implementation.
- `src/lib/client.functions.ts:939-1490` — every writer guarded.
- `src/lib/interviews.functions.ts` — same guard on interview writers.
- Client routes under `src/routes/_authenticated/client.*.tsx` — no branches on `readOnly` other than disabling controls / showing banner.

**Visible data mismatches: 0. Support-view mutation acceptance: 0. Verdict: PASS.**
