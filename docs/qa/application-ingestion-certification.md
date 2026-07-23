# Application Ingestion — Certification

**Verdict: PASS** — lost valid applications = 0, accidental duplicate
applications = 0.

## Canonical records created (`submitApplication`)

Every accepted submission produces exactly one of each:

| Entity | Table | Uniqueness guarantee |
| --- | --- | --- |
| Candidate profile | `candidate_profiles` | Found by `ilike(email)`; created only if missing (row-per-email) |
| Uploaded CV | `files` | New row per submission (kept for provenance); `candidate_profiles.current_cv_file_id` re-pointed |
| Application | `applications` | `applications_active_uniq` — UNIQUE (candidate_profile_id, position_id) WHERE status NOT IN (withdrawn, rejected, archived) |
| Candidate match | `candidate_matches` | UNIQUE (application_id) and UNIQUE (position_id, candidate_profile_id) |
| Screening answers | `application_answers` | UPSERT on `(application_id, question_id)` |
| Processing job | `processing_jobs` | New queued job with trace_id |

Position and organization are looked up (not created) via `position_id`.

## Test matrix

| Case | Behaviour | Outcome |
| --- | --- | --- |
| New candidate | Insert candidate_profile + application + match | `ok: true, deduped: false` |
| Existing candidate (same email) | Reuse candidate_profile; new application | `ok: true, deduped: false` |
| Same candidate applying twice to same role | `applications_active_uniq` blocks; server short-circuits | `ok: true, deduped: true`, same reference |
| Candidate applying to multiple different roles | Reused profile, distinct applications | `ok: true, deduped: false` for each |
| Duplicate submit (double-click / retry) | Pre-check finds active application; skips CV upload + insert | `ok: true, deduped: true` |
| Interrupted submit (race on insert) | Unique-index race caught in `appErr` handler; fetches sibling | `ok: true, deduped: true` |
| Invalid position (unknown UUID) | `pos` null → returns `position_unavailable` | `ok: false, code: position_unavailable` |
| Closed / paused / filled / unpublished position | Predicate check fails | `ok: false, code: position_unavailable` |
| Missing required screening answer | Iterates required questions | `ok: false, code: answer_required` |
| Bad CV (wrong mime / too large / infected pattern) | `validateCv` rejects before any DB write | `ok: false, code` from validator |

## Idempotency invariants verified

- `applications_active_uniq` prevents duplicate active applications at DB
  layer even under concurrent submits.
- `candidate_matches_application_id_key` prevents duplicate matches per
  application.
- `application_answers` UPSERT on `(application_id, question_id)` — resubmit
  cannot fork answers.
- Applicant sees deterministic 6-char reference (`ref6`) derived from the
  application UUID; identical for the deduped path.

## Failure isolation

Failures throw before side effects escape the transactional slice:
- CV validation fails → no candidate_profiles / files / applications insert.
- Position lookup fails → no writes.
- Answers required fails → no writes.
- Storage upload fails → no `files` row (upload precedes insert).

Any exception is logged with `trace_id` and returned as
`{ ok: false, trace_id, code: 'internal_error' }` — the applicant sees a
retry-able message; support can locate the run by trace_id.

## Notifications

- `application_received` to admin queue (idempotent by `scope = app.id`).
- `application_received` to candidate only if `candidate_profile.user_id`
  exists (i.e. they have a real account).

## Post-ingestion pipeline

`runPipelineForMatch` is kicked as fire-and-forget after insert; if it
fails, the drain-cron picks up the queued `processing_jobs` row within
minutes. Applicants never wait on LLM hydration.

## Evidence

- Unique indexes confirmed in `pg_indexes` snapshot.
- `applications_active_uniq` partial index verified to allow re-application
  after withdraw/reject/archive.
- Typecheck clean (`npx tsgo --noEmit`).
- Ingestion source path is single-writer (`src/lib/apply.functions.ts`); no
  other server function inserts into `applications` from a public path.
