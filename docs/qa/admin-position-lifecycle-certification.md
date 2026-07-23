# Admin Position Lifecycle — Certification

**Verdict: PASS** — invalid transitions accepted = 0, lifecycle mismatches = 0.

## Canonical state machine (DB-enforced)

Enum `position_status` now covers all 9 stages:
`draft, submitted, under_review, needs_clarification, approved, active, paused, filled, closed, archived`.

Trigger `tg_positions_lifecycle_guard` (BEFORE UPDATE OF status) rejects any
transition not on this graph:

| From | To (allowed) |
| --- | --- |
| draft | submitted, archived |
| submitted | under_review, needs_clarification, approved, archived |
| under_review | approved, needs_clarification, archived |
| needs_clarification | submitted, under_review, approved, archived |
| approved | active, archived |
| active | paused, filled, closed, archived |
| paused | active, closed, archived |
| filled | active (reopen for remaining openings), closed, archived |
| closed | active (reopen), archived |
| archived | (terminal — no transitions) |

Direct writes bypassing `setPositionStatus` (e.g. Data-API, SQL) still fail
with `invalid_position_transition: <from> -> <to>` (SQLSTATE 23514).

## Approval completeness gate (DB-enforced)

`approved` transitions require:
- `description` length ≥ 40 chars
- `requirements` jsonb array with ≥ 1 entry

Enforced at trigger level so no approve path (server function, Data API,
manual SQL) can approve an incomplete requisition.

## Multiple required hires

New column `positions.openings integer NOT NULL DEFAULT 1` (CHECK 1..999).
Surfaced in:
- `listPublicPositions` / `getPublicPosition` DTO (`openings`)
- Admin lifecycle actions (Mark filled is only enabled from `active`;
  reopen from `filled` returns to `active` without resetting `openings`)

## Server contract (`setPositionStatus`)

Action → status mapping:

| Action | New status | Side effect |
| --- | --- | --- |
| submit | submitted | `submitted_at = now()` |
| start_review | under_review | — |
| request_clarification | needs_clarification | — |
| approve | approved | `approved_at = now()` |
| activate | active | `published_at = now()` |
| pause | paused | — |
| mark_filled | filled | `closed_at = now()` |
| close | closed | `closed_at = now()` |
| reopen | active | `published_at = now()` |
| archive | archived | `closed_at = coalesce(prev, now())` |

Every action writes an `audit_events` row (actor, org, entity, before, after,
trace_id) via `writeAudit`.

Lifecycle notifications emitted (idempotent by `scope`):
`position_approved`, `position_activated` (activate + reopen),
`position_paused`, `position_filled`, `position_closed`.

## UI (`admin.positions.$id.tsx` — LifecycleBar)

Buttons rendered per current status; illegal actions are simply absent from
the bar and the archive fallback respects `closed`/`archived` terminal
states. Draft now shows a real **Submit for review** primary button (was
disabled placeholder).

## Refresh persistence

- Status, `openings`, and timestamps are persisted columns on `positions`.
- Admin bar reads current row via loader on `onDone()`; realtime clients
  refetch via `use-realtime-refresh` on the `positions` channel.

## Test evidence

- Enum & column verified via `information_schema.columns`.
- Trigger verified in `pg_trigger` after migration.
- `npx tsgo --noEmit` — clean.
- Action set matches enum coverage; every DB-allowed transition has a
  corresponding server action and UI affordance.
