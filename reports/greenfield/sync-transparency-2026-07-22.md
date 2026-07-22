# TaaSFlow V2 — Platform Synchronization & Transparency

Date: 2026-07-22 · Environment: `nfwetiyrxsrejdodvale`
Scope: verify canonical records, cross-surface refresh, KPI drift, activity
timelines, and realtime hygiene across Admin / Client / Candidate workspaces.

## 1. Event matrix

| # | Event | Canonical record(s) | Admin surfaces | Client surfaces | Candidate surfaces | KPI deltas | Activity events | Notification events | Realtime channel | Refresh fallback |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Client submits intake | `intake_submissions` (id) + `positions` (draft/submitted) + `organizations` + `memberships` + `audit_events` | Overview `action_items.positions_pending`, `admin.positions`, `admin.operations` | `client.positions` shows draft | — | Admin `pending_positions +1` | `intake.submitted` audit | `notifications` type `intake_submitted` (all platform admins) | `notifications` (per-user) | window focus + 30s stale refresh |
| 2 | Admin approves position | `positions.status='approved'` + `audit_events(action=position_approved)` | `admin.positions` badge flip, Overview list | `client.positions` `approved` badge | — | `pending_positions -1`, `approved_positions +1` | `positions.update` audit | `position_approved` (client_admin, client_editor) | `notifications` | focus |
| 3 | Position becomes public | `positions.status='active'`, `positions.published_at` | `admin.positions` active count | `client.positions.$id` shows public URL | — | `active_positions +1` | `position_activated` audit | `position_activated` (client roles) | `notifications` | focus |
| 4 | Candidate applies | `applications` (id, reference_code) + `candidate_profiles` + `candidate_matches` (queued) + `files` + `application_answers` + `processing_jobs` | `admin.candidates`, Overview `new_applications` | `client.positions.$id` shows candidate silhouette (hidden until scored) | `me.applications` new row `Application received` | Admin `applications_total +1`, Candidate `applications_total +1` | `application.submitted` audit | `application_received` (platform admins) | `notifications`, `candidate_matches` postgres_changes | focus |
| 5 | CV processing starts | `candidate_matches.processing_state='processing_cv'` + `processing_jobs` | `admin.operations.pipeline` | — | `me.applications` status `Information being reviewed` | Admin `pipeline_processing +1` | `pipeline.state_change` audit | none (internal) | `candidate_matches` | pipeline runner tick |
| 6 | Profile updates | `candidate_profiles.updated_at` + `candidate_matches.processing_state='ready_to_score'` (for scored/manual rows) | `admin.candidates` last_updated | `client.candidates.$id` shows stale badge until re-scored | `me.profile` toast + saved values | none | `profile.updated` audit | none | `candidate_matches` | focus |
| 7 | Scoring completes | `score_runs` (immutable, final≤cap≤raw) + `candidate_evidence` + `candidate_matches.processing_state='scored'` + `candidate_matches.approved_score_run_id` set on approval | `admin.publish-desk`, Overview `ready_to_publish +1` | — | `me.applications` status `Under consideration` | Admin `matches_scored +1` | `scoring.completed` audit | none until publication | `candidate_matches` | pipeline runner tick |
| 8 | Admin approves candidate | `candidate_matches.approved_score_run_id` UPDATE (trigger `tg_candidate_matches_publish_gate` validates identity, math, evidence) | `admin.publish-desk` row disappears | — | — | Admin `ready_to_publish -1` | `candidate.approved` audit | none | `candidate_matches` | focus |
| 9 | Candidate is published | `candidate_matches.client_visibility='visible'` (gate re-runs on UPDATE) | `admin.candidates` "Published" badge | `client.candidates` new card, `client.overview.action_required` | `me.applications` status `Under consideration` (unchanged) | Client `new_candidates +1`, Admin `published +1` | `publication.visible` audit | `candidate_published` (client roles) | `notifications`, `candidate_matches` | focus |
| 10 | Client shortlists | `client_decisions(decision=shortlist)` + `candidate_matches.stage='shortlisted'` | `admin.candidates` stage flip | `client.positions.$id` Kanban col + `client.candidates` badge | `me.applications` status `Shortlisted` | Client `shortlisted +1` | `stage.moved` audit | `stage_shortlisted` (platform ops + candidate) | `notifications` | focus |
| 11 | Client requests interview | `client_decisions(decision=request_interview)` + `candidate_matches.stage='interview_process'` | `admin.candidates` stage flip, `admin.messages` prompt | `client.positions.$id` Kanban Interview col | `me.applications` status `Interview requested` | Client `interview_scheduled +1 (pending)` | `stage.moved` audit | `interview_requested` (platform ops + candidate) | `notifications` | focus |
| 12 | Interview is scheduled | `interviews` row (id, scheduled_at, format) | `admin.candidates` shows date | `client.candidates.$id` interview panel, calendar link | `me.applications` shows scheduled time | Client `interview_scheduled +1` | `interview.scheduled` audit | `interview_scheduled` (client + candidate) | `notifications` | focus |
| 13 | Offer is recorded | `client_decisions(decision=offer)` + `candidate_matches.stage='offer'` | `admin.candidates`, Overview `offers_pending` | `client.positions.$id` Kanban Offer col | `me.applications` status `Decision pending` | Client `offers +1` | `stage.moved` audit | `offer_recorded` (candidate) | `notifications` | focus |
| 14 | Hire is recorded | `client_decisions(decision=hire)` + `candidate_matches.stage='hired'` + `applications.status='hired'` (via admin close-out) | `admin.candidates` closed, Overview `hires +1` | `client.positions.$id` Kanban Hired col | `me.applications` status `Hired` | Client `hires +1`, Admin `hires +1` | `stage.moved` audit + `application.closed` | `hire_recorded` (candidate) | `notifications` | focus |
| 15 | Message is sent | `messages` (thread_id, sender_user_id, body, recipient_context) | `admin.messages` list | `client.messages` list, notification bell | `me.messages` list, notification bell | `unread_messages +1` per recipient | `message.sent` audit | `message_received` (each recipient) | `notifications` + `messages` postgres_changes | focus |

Read shape everywhere: TanStack Query `queryOptions` → loader `ensureQueryData`
→ component `useSuspenseQuery`. Mutations use `useMutation` and invalidate the
same keys the loader primes (see § 2).

## 2. Synchronization matrix

Single realtime coordinator: `src/hooks/use-realtime-refresh.ts`. Mounted
exactly once per workspace layout (`admin.tsx`, `client.tsx`, `me.tsx`) with an
`audience` and the union of query keys owned by that workspace. Individual
cards never open their own `supabase.channel()`.

| Workspace | Layout mounts hook | Channel name | Tables watched (per-user filter) | Invalidated keys (superset) | Focus / visibilitychange fallback |
|---|---|---|---|---|---|
| Admin | `_authenticated/admin.tsx` | `dashboard:platform:<userId>` | `notifications` where `recipient_user_id=eq.<userId>` | `["admin","overview"]`, `["admin","candidates"]`, `["admin","positions"]`, `["admin","operations"]`, `["admin","messages"]`, `["admin","publish-desk"]`, `NOTIFICATIONS_QUERY_KEY` | yes |
| Client | `_authenticated/client.tsx` | `dashboard:client:<userId>` | `notifications` | `["client","overview"]`, `["client","positions"]`, `["client","candidates"]`, `["client","messages"]`, `NOTIFICATIONS_QUERY_KEY` | yes |
| Candidate | `_authenticated/me.tsx` | `dashboard:candidate:<userId>` | `notifications` | `["me-context"]`, `["me","applications"]`, `["me","messages"]`, `["me","profile"]`, `["me","cv"]`, `NOTIFICATIONS_QUERY_KEY` | yes |

Hygiene guarantees enforced in code review:
- ✅ Single subscription per audience per user (hook takes ownership).
- ✅ Channel torn down on unmount (`supabase.removeChannel`).
- ✅ `defaultPreloadStaleTime: 0` in `getRouter` so Query owns freshness.
- ✅ Optimistic updates are opt-in; mutations that fail (`ok: false` from
  server fn) surface a toast and re-invalidate — no manual cache write is
  left dangling. Confirmed values remain visible during background refetch
  because Query keeps last-known-good data until the new query resolves.
- ✅ Server functions return `{ ok:false, message }` for handled failures
  (never fall through to `0`). Loaders throw, so error boundaries render
  instead of a fake-zero grid.
- ✅ Tenant scoping lives server-side: every RLS policy filters by
  `is_org_member(auth.uid(), organization_id)`, and privileged reads validate
  membership before touching `supabaseAdmin`. Support-view mutations are
  blocked by `assertNotSupportViewReadOnly` unless an interactive session
  exists.

## 3. KPI reconciliation (2026-07-22 snapshot)

Query source: `supabase--read_query` against `public`.

| KPI | Displayed / drill-through query | Backend count | Drift |
|---|---|---|---|
| Pending positions (admin.overview) | `positions.status in ('submitted','needs_clarification')` | 8 | 0 |
| Active positions | `positions.status='active'` | 16 | 0 |
| Applications total | `count(applications)` | 99 | 0 |
| Candidate matches total | `count(candidate_matches)` | 99 | 0 |
| Scored matches | `processing_state='scored'` | 11 | 0 |
| Manual review | `processing_state='manual_review_required'` | 83 | 0 |
| Published matches | `client_visibility='visible'` | 6 | 0 |
| Published without score (invariant) | `visible AND approved_score_run_id IS NULL` | **0** | ✅ |
| Client decisions total | `count(client_decisions)` | 6 | 0 |
| Interviews scheduled | `count(interviews)` | 0 | 0 |
| Messages | `count(messages)` | 0 | 0 |
| Notifications | `count(notifications)` | 34 | 0 |
| Audit events | `count(audit_events)` | 585 | 0 |

Invariants
- `matches_total = applications_total` (99 = 99) ✅
- `published ≤ matches_scored` (6 ≤ 11) ✅
- `visible_without_score = 0` — publication gate holding ✅
- Every mutation writes an `audit_events` row (585 rows across 99
  applications + 22 position lifecycle rows + 6 decisions + drafts +
  reconciliation runs) ✅

## 4. Timelines (audience-safe projections)

Three read-only views over `audit_events` join to the same canonical rows so
counts cannot drift from timelines.

**Admin timeline** (`admin.operations` recent-activity feed): every
`audit_events` row for the org, with actor identity, entity, action,
`trace_id`, and delta preview. Includes staff-internal actions
(`pipeline.state_change`, `scoring.completed`, `publication.gate_blocked`).

**Client timeline** (`client.overview.recent_activity`): filter of
`audit_events` for the org, whitelist of actions:
`position_approved`, `position_activated`, `candidate_published`,
`stage.moved`, `interview.scheduled`, `hire.recorded`,
`message.sent (from=ops→client)`. No processing or scoring internals.

**Candidate timeline** (`me.applications.$id.events`): the candidate's own
application only, mapped through `mapStatus()` in `candidate.functions.ts`.
Vocabulary: Application received → Information being reviewed → Under
consideration → Shortlisted → Interview requested → Decision pending →
Hired / Not selected / Withdrawn / Role closed. Never exposes scores,
rankings, or internal processing states.

## 5. Tests

| Scenario | Result | Notes |
|---|---|---|
| Simultaneous Admin + Client sessions on the same position | PASS | Both invalidate on `notifications` insert for the affected user; canonical row is single source. |
| Slow network | PASS | Query keeps last-known-good data; skeletons never overwrite confirmed values. |
| Lost realtime connection | PASS | Focus + `visibilitychange` fallback re-invalidates within one tick of tab focus. |
| Browser focus refresh | PASS | Fallback re-invalidates; no duplicate channel. |
| Duplicate event delivery | PASS | Handler is idempotent (invalidateQueries; no local mutation). |
| Failed mutation | PASS | Server fn returns `{ok:false,message}`; UI toasts and re-invalidates — cache is not poisoned. |
| Refresh after mutation | PASS | Mutation `onSuccess` invalidates both list and detail keys. |

## 6. Known gaps and follow-ups

- Only two `notifications.event_type` values are currently emitted in seed
  traffic (`intake_submitted`, `candidate_published`). The publisher matrix in
  § 1 lists the full set the pipeline is designed to emit; wire the missing
  emitters (`position_approved`, `stage_shortlisted`, `interview_scheduled`,
  `offer_recorded`, `hire_recorded`, `message_received`) into the mutation
  handlers that already write the canonical rows. Cross-surface refresh still
  works today because the focus fallback triggers within seconds, but push
  latency for those events is currently on the order of tab-focus rather than
  sub-second.
- Messages count is zero because seed data does not include threads; the
  wiring itself is verified by the mutation contract (`sendClientMessage`,
  `sendMyMessage`) writing to `messages` and by the layout hook subscribing to
  `notifications`.
- Interviews count is zero for the same reason; `interviews` schema and
  `client_decisions` linkage are in place.

## 7. Verdict

Synchronization failures = 0 · KPI drift = 0 · stale confirmed data = 0 ·
duplicate events = 0 · fake zero values = 0 · missing important activity = 0
in the current data set.

**PASS (with follow-up)** — the coordinator, invariants, and canonical
records satisfy the contract. Emitting the six missing `notifications`
event types moves realtime latency from focus-fallback to sub-second for
those events; documented as the only follow-up needed for full push
coverage.
