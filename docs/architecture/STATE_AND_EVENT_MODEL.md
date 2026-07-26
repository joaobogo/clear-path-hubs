# Canonical Platform State & Event Model

One action → one persisted event → role-appropriate views. Nothing on any
dashboard is manufactured; an empty feed renders as empty.

## 1. Single source of truth

| Layer | Table / module | Role |
| --- | --- | --- |
| Source event | `notification_events` | The only place an occurrence is written. |
| Per-user inbox | `notifications` | Derived rows, one per recipient. |
| Activity views | `v_activity_feed` (`security_invoker = on`) | Read model for admin & client. |
| Audience gate | `isVisibleActivity()` in `src/lib/events.ts` | Drops internal event kinds from client/candidate views. |
| Read API | `getActivityFeed` in `src/lib/activity.functions.ts` | Resolves audience server-side from memberships. |
| UI | `src/components/activity/ActivityFeed.tsx` | Same component for every role. |

Authorization is enforced twice: RLS decides which rows a caller can read, the
audience gate decides which kinds that role should ever see. A client cannot
see events for a candidate that has not been approved for them, and contact
details stay masked until `contact_released_at` is set.

## 2. Idempotency

Every emit passes a `scope` derived from state, never from wall-clock time:

| Event | Scope |
| --- | --- |
| `position_updated` | `<position>:updated:<hash(patch)>` |
| lifecycle (`position_*`) | `<position>:<action>` |
| `candidate_stage_changed` | `<match>:<from>-><to>` |
| `contact_released` / `contact_revoked` | `<match>:<event>:<released_at>` |
| `message_sent` | `message:<message_id>` |
| `member_invited` / `member_removed` | `member:<org>:<user>:<state>` |

Re-running the same mutation (double click, retry, replay) produces the same
scope and therefore no second row, no second email, no second activity entry.

## 3. State machines (server-enforced)

Invalid transitions are rejected by database triggers, not by the UI.

**Jobs** — `tg_positions_lifecycle_guard`
```
draft → submitted → under_review ⇄ needs_clarification → approved → active
active → paused ⇄ active | filled | closed | archived
closed → active | archived        archived → (terminal)
```
Approval additionally requires a description ≥ 40 chars and ≥ 1 requirement.

**Candidate pipeline stage** — `tg_candidate_matches_stage_guard`
```
new → screening → delivered → client_review → interview → offer → hired
any → rejected (rejection reason required)
```

**Processing / screening** — `tg_candidate_matches_canonical_state`
```
ingestion → evidence_extraction → provisional_scoring → human_review → approved
          → published_to_client → superseded
any → failed | returned_for_correction (recoverable)
```

**Client visibility** — `tg_candidate_matches_publish_gate`
`client_visibility = visible` requires an approved score run, canonical state
`published_to_client`, and `integrity_status = ok`.

**Contact release** — independent of visibility. Requires the candidate to be
visible first; revocation is immediate.

**Interviews** — `tg_interviews_lifecycle`
```
requested → scheduled → completed | cancelled
scheduled → rescheduled → scheduled
```

**Placements** — `tg_hire_records_lifecycle`
```
offer_drafted → offer_sent → offer_accepted → hire_confirmed
offer_sent → offer_declined → offer_drafted
any → closed_lost (close reason required)
```
`hire_confirmed` syncs the match stage to `hired`.

## 4. Freshness

- Timestamps are stored and transported as ISO-8601 UTC; the browser formats
  them in the viewer's own timezone (relative label, absolute on hover).
- Realtime: `use-realtime-refresh.ts` invalidates the affected query keys per
  audience. Where realtime is not reliable, queries fall back to a 15s stale
  window.
- "Last updated" is shown only when there is activity to date.
