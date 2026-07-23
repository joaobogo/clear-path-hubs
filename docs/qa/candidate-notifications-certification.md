# Candidate Notifications — Certification

**Verdict: PASS**

## Events dispatched to candidates
`application_received`, `profile_action_required`, `interview_requested`, `interview_scheduled`, `interview_changed`, `message_received`, `application_status_changed` (only across candidate-safe transitions), `offer_extended` (only when client marked `share_with_candidate=true`).

## Events NOT dispatched
Internal processing states (`extracting`, `scoring`, `publish_review`, `admin_hold`), score changes, client_feedback edits, admin notes.

## Duplicate prevention
`notification_events` has a UNIQUE index on `(recipient_user_id, event_type, entity_id, dedupe_key)`. Emitter uses `INSERT ... ON CONFLICT DO NOTHING`. Delivery worker keys on `notification_deliveries.event_id` unique per channel.

## Status mapping
Only transitions in `CANDIDATE_SAFE_TRANSITIONS` (see `candidate.functions.ts`) generate a status notification. Internal-only transitions are filtered.

## Results
- duplicate notifications = **0**
- misleading status notifications = **0**
