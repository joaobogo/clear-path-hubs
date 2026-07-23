# Admin "View as Client" — Support Mode Safety Certification

**Verdict: PASS** — support-mode mutations accepted = **0**.

## Scope

Support mode is entered when a platform staff member (`platform_admin` /
`operations`) navigates a Client workspace URL with `?org=<uuid>` for an
organization where they hold no client-role membership. Two modes exist:

| Mode | Requires | Guard |
| ---- | -------- | ----- |
| `read_only` (default) | Any platform staff | UI hides mutation controls + backend rejects |
| `interactive` | `platform_admin` only + typed reason (≥10 chars) + open `support_sessions` row before 30-min expiry | Backend allow-lists writes |

## 1. Renderer identity — Client-only, no forks

Support mode reuses the **exact** Client renderers. There is no
`AdminAsClient*` shadow tree. Verified by import graph:

- `src/routes/_authenticated/client.tsx` — sets `SupportViewContext` when the
  viewer is staff-in-another-org.
- All child routes read from the same context via `useSupportView()`:
  `client.candidates.$id.tsx`, `client.positions.$id.tsx`,
  `client.messages.tsx`, `client.interviews.tsx`, `client.team.tsx`,
  `client.settings.tsx`.
- DTOs served to the shell are the **Client-safe** DTOs
  (`src/lib/client.functions.ts` and `client-kpi.server.ts`) — no admin-only
  fields (raw evidence, cost, blueprint version) are surfaced through these
  server functions.

## 2. Allowed capabilities (verified)

| Action | Wired | Notes |
| ------ | ----- | ----- |
| Navigate | ✅ | Standard router; no gating change |
| Search | ✅ | `globalSearch` (`src/lib/global-search.functions.ts`) is scoped to caller memberships + RLS; staff scope defaults to `admin` unless they opt into `client` |
| Filter | ✅ | Read-only URL search params |
| Open positions | ✅ | `client.positions.$id.tsx` |
| Open candidates | ✅ | `client.candidates.$id.tsx` |
| Compare candidates | ✅ | `client.candidates.index.tsx` Kanban / list |
| Inspect messages | ✅ | `client.messages.tsx` renders threads in read mode |
| Inspect activity | ✅ | `client.index.tsx` activity strip |

## 3. Denied capabilities (verified, UI + backend)

Every mutation surface is gated **twice**: (a) the UI hides / disables the
control based on `useSupportView().readOnly`, (b) the backend rejects with the
typed `SUPPORT_VIEW_READ_ONLY` error even if the request is crafted by hand.

Backend guards live in:

- `src/lib/client.functions.ts` → `assertNotSupportViewReadOnly` (staff
  without an active `interactive` `support_sessions` row → reject).
- `src/lib/interviews.functions.ts` → `assertEditor` (same shape).

| Denied action | UI guard | Backend guard |
| ------------- | -------- | ------------- |
| Shortlist / stage change | `client.candidates.$id.tsx:197` `readOnly` disables actions; kanban DnD rejects | `updateMatchStage` → `assertEditor` (client.functions.ts:618) |
| Reject candidate | `readOnly` on card actions | `updateMatchStage` → `assertEditor` |
| Request interview | `client.interviews.tsx:124` `readOnly` hides "Schedule" | `scheduleInterview` / `updateInterview` → `assertEditor` (interviews.functions.ts:295,357) |
| Send messages | `client.messages.tsx:122` `canSend=false` | `postMessage` → `assertNotSupportViewReadOnly` (client.functions.ts:854,924) |
| Change settings | `client.settings.tsx:148` banner + all `canEdit={false}` | `updateOrganization*` → `assertNotSupportViewReadOnly` (client.functions.ts:989,1017,1052,1081) |
| Invite users | `client.team.tsx:133` `canMutate=false` + banner | `inviteMember` / `updateMember` / `removeMember` → `assertNotSupportViewReadOnly` (client.functions.ts:1254,1305,1365) |
| Submit / approve positions | `client.positions.$id.tsx:144,187` disables submit | `submitPositionForReview` / `updatePosition` → `assertEditor` (client.functions.ts:766) |

## 4. Direct backend mutation attempts

Simulated calls with a signed-in staff bearer token to each mutation server fn
against an org where the caller has no client membership and no `interactive`
support session:

```
POST /_serverFn/updateMatchStage        → Error: SUPPORT_VIEW_READ_ONLY
POST /_serverFn/postMessage             → Error: SUPPORT_VIEW_READ_ONLY
POST /_serverFn/scheduleInterview       → Error: SUPPORT_VIEW_READ_ONLY
POST /_serverFn/updateOrganizationName  → Error: SUPPORT_VIEW_READ_ONLY
POST /_serverFn/inviteMember            → Error: SUPPORT_VIEW_READ_ONLY
POST /_serverFn/submitPositionForReview → Error: SUPPORT_VIEW_READ_ONLY
```

All rejected before touching the database. `audit_events` shows only
`support.session_started` rows for the run, no downstream state changes.

## 5. Audit trail

Every support-view entry writes a `support_sessions` row + an
`audit_events.action = "support.session_started"` row containing the target
organization, mode, permission preview, and (in interactive mode) the
operator's typed reason.

## Certification summary

- Support-mode mutation attempts accepted: **0**
- Renderers used: Client-only (no admin fork)
- DTOs served: Client-safe (no admin-only fields leaked)
- Escalation path: interactive mode → `platform_admin` only, typed reason,
  30-minute expiry, fully audited

**PASS.**
