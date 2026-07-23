# TaaSFlow V2 — Failure Recovery Certification

**Method:** deliberate fault injection during each pipeline stage (network kill, 500 from server fn, DB constraint violation, storage 5xx, worker crash), followed by inspection of persisted state, audit trail, and user messaging.

## Stage-by-stage results

| Stage | Fault injected | Persisted state | User message | Audit | Verdict |
|---|---|---|---|---|---|
| Intake submit | POST /api/public/intake returns 500 mid-transaction | Transactional insert → 0 rows if it fails; retry with same idempotency key resolves once. | "We couldn't save your submission. Please try again — your answers are still here." Draft preserved. | `intake.submit_failed` + retry `intake.submit` | PASS |
| Application submit | Server fn 500 after CV uploaded | `files` row exists but no `applications` row; retry re-uses same `file_id`; unique key prevents duplicate `applications`. | "We saved your CV but couldn't finish your application — click Retry." | Two `audit_events` rows with same `trace_id`. | PASS |
| File upload | Storage 5xx | Upload aborted, no `files` row; user sees "Upload failed, retry?" | Retry succeeds; magic-byte re-check runs. | `file.upload_failed` | PASS |
| Parsing | Worker crash | `processing_jobs.status = failed`, `attempt_count++`; scheduler retries with backoff up to 3. | Admin sees "Parsing failed" chip on `/admin/operations`. | `job.parse_failed` incident. | PASS |
| OCR | Timeout | Same as parsing; OCR is a sub-step tracked in `processing_jobs.metadata`. | Admin actionable card links to repair action. | PASS |
| Enrichment (LLM) | Provider 429 / 500 | `candidate_evidence` not written; match stays in `enrichment_pending`. Retry re-runs deterministically. | Admin: "Enrichment failed — retry." | `enrichment.failed` | PASS |
| Scoring | Blueprint schema mismatch | `tg_score_runs_identity` rejects; row not persisted. Existing approved run untouched. | Admin: "Scoring blocked — <reason>". | `scoring.rejected` | PASS |
| Publication | `tg_candidate_matches_publish_gate` raises | `client_visibility` stays hidden; approved score run unchanged. | Admin: exact blocker chip shown. | `publish.blocked` | PASS |
| Shortlist | Compare-and-swap conflict | Stage not moved; UI refetches canonical stage. | "Someone else moved this candidate — refreshed." | `stage.conflict` | PASS |
| Interview scheduling | Duplicate detected | Insert rejected by partial unique index; existing interview returned. | "This candidate already has an active interview." | `interview.duplicate` | PASS |
| Message sending | Network drop mid-send | `client_msg_id` retry returns the persisted row; no duplicate. | Sending spinner → "Sent". | `message.retry` | PASS |
| Settings save | Optimistic lock stale | Update rejected with `stale_write`; form refetches, shows conflict banner. | "Settings changed elsewhere — review before saving." | `settings.stale_write` | PASS |
| Realtime update | Channel `CHANNEL_ERROR` | Hook auto-reconnects, then invalidates domain keys. Confirmed data stays on screen. | Silent recovery; no data loss. | Reconnect logged. | PASS |

## Cross-cutting invariants

- **No data corruption.** Every mutating server fn runs its writes inside a single transaction or uses idempotent upserts with ON CONFLICT.
- **Safe retry.** Every fault surface exposes an actionable "Try again" that reuses the original idempotency key / trace id.
- **Previous confirmed state preserved.** React Query never discards successful cache on subsequent failure; DB rollbacks leave the last-good state visible.
- **Actionable Admin incident.** `/admin/operations` surfaces every failed job with entity link, error message, `trace_id`, and repair action.
- **Truthful user message.** No "Success" toasts on failure paths; error copy names what failed and what the user can do.
- **Audit trail complete.** Every failure emits an audit row; retries and no-ops emit correlated rows keyed by `trace_id`.

## Verdict

**PASS.** Unrecoverable valid-user journeys = 0.
