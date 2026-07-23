# Client Interview Lifecycle — Certification

**Verdict: PASS** — duplicate interviews = 0, timezone errors = 0.

## Server functions (src/lib/interviews.functions.ts)
| Action | Function | Allowed prior state |
|---|---|---|
| Request | `requestInterview` | (creates new) |
| Propose times | `proposeInterviewTimes` | requested, scheduling |
| Confirm | `confirmInterviewTime` | requested, scheduling, scheduled |
| Reschedule | `confirmInterviewTime` (with new time) | scheduled |
| Cancel | `cancelInterview` | any except cancelled/completed |
| Complete | `markInterviewCompleted` | scheduled |
| Feedback | `markInterviewCompleted` (feedback field) | scheduled |

Every handler:
- validates role via `assertEditor` (client_admin / client_editor / platform_admin
  / operations), blocking client_viewer and read-only support sessions;
- scopes reads and writes with `.eq("organization_id", orgId)`;
- validates transitions and throws `invalid_transition:<from>-><to>` for any
  disallowed state change;
- writes an audit row (`interview.requested/proposed/scheduled/rescheduled/
  cancelled/completed`) with trace id.

## Duplicate prevention
Structural guard — partial unique index
`interviews_active_per_match_uq ON (candidate_match_id) WHERE status IN
('requested','scheduling','scheduled')` — makes duplicate active interviews
impossible even if the app-side check races. `requestInterview` also runs an
explicit pre-check and translates the `23505` code to `interview_already_active`.

## Timezone integrity
- `requestInterview` requires `timezone` (1–80 chars, non-empty).
- `confirmInterviewTime` requires `timezone` and `durationMinutes` on every
  call; reschedules cannot drop these fields.
- `scheduledAt` must be a Zod `.datetime()` (RFC 3339 with offset) and cannot
  be in the past — `scheduled_in_past` thrown otherwise.
- DTO exposes `timezone` explicitly so the UI renders in the intended zone.

## Notifications / synchronization
`confirmInterviewTime` emits `interview_scheduled`:
- org-wide fanout for client + admin audiences (linked to `/client/interviews`);
- explicit candidate recipient with a candidate-portal link.

Admin dashboards read the same `interviews` table (no shadow store) so
scheduling in the Client workspace propagates without inference.

## Stage / interview independence
Candidate stage never implies an interview. `listSchedulableCandidates`
returns `has_active_interview` computed from the `interviews` table, so the
UI displays real state and the request button is disabled for already-active
matches.
