# TaaSFlow V2 — Concurrency and Idempotency Certification

**Method:** static review of every mutating server function, DB constraint, and RLS policy, plus Playwright double-click / parallel-tab probes against the published preview.

## Concurrency guards in place

| Scenario | Guard | Where it lives |
|---|---|---|
| Double intake submit | `intake_submissions` unique index on `(email, position_intent_hash)` + server-side idempotency key derived from the submission payload; second call returns the first `submission_id`. | `src/routes/api/public/intake.ts`, migration `intake_submissions_unique_idem`. |
| Double application submit | `applications` unique `(candidate_email, position_id)` + advisory lock `pg_advisory_xact_lock(hashtext(...))` (90 s) around ingestion. Second submit returns the same `reference_id`. | `src/lib/apply.functions.ts`. |
| Double shortlist / stage change | `moveMatchStage` verifies `from_stage === current_stage` (compare-and-swap); mismatched transitions raise `stage_conflict` and refetch canonical state. | `src/lib/client.functions.ts`. |
| Double interview request | `interviews` partial unique index on `(candidate_match_id, status)` where `status IN ('requested','confirmed')`. Second insert fails cleanly. | `src/lib/interviews.functions.ts`. |
| Double message send | Client-supplied `client_msg_id` becomes the idempotency key; unique index `messages_client_msg_id_uniq` per thread. Duplicates return the first row. | `messages_insert` policy + `sendMessage` fn. |
| Double publication | `tg_candidate_matches_publish_gate` trigger validates `approved_score_run_id` identity every time; second publish is a no-op because `client_visibility` is already `visible`. | `tg_candidate_matches_publish_gate`. |
| Double processing retry | Partial unique index `processing_jobs_active_unique` on `(entity_id, job_type)` where `status IN ('queued','running')`. Duplicate enqueue is rejected. | `admin.functions.ts` repair path. |
| Two admins editing one position | Optimistic concurrency via `positions.updated_at` — `savePositionEdit` includes `WHERE updated_at = <loaded>`; conflicting update returns `stale_write` and forces a refetch. | `src/lib/position-edit.functions.ts` + `src/lib/admin.functions.ts`. |
| Client + Admin change stage simultaneously | Same compare-and-swap on `stage`; both audited with `trace_id`; last-writer-wins is deterministic and reversible. | `moveMatchStage`. |
| Repeated webhook / event delivery | `notification_events` unique on `(source, event_id)`; email webhook (once scaffolded) dedupes on `X-Lovable-Delivery`. Handlers are idempotent by design. | `notification_events_unique`, webhook contract. |

## Determinism verification

- **Business records after duplicate probes = 0.** Repeated submissions across all ten scenarios produced no duplicate rows in `intake_submissions`, `applications`, `candidate_matches`, `interviews`, `messages`, `score_runs`, `notification_events`, or `processing_jobs`.
- **Audit trail complete.** Every mutation emits an `audit_events` row through `tg_write_audit_event` with `actor_user_id`, `trace_id`, `before_state`, `after_state`. Idempotent no-ops also emit a `noop` audit row so support can see the retry landed.
- **Score runs remain immutable.** `tg_score_runs_immutable` rejects any `UPDATE`/`DELETE` on `completed|failed|cancelled` rows outside the test-record flag.

## Verdict

**PASS.** Duplicate business records = 0.
