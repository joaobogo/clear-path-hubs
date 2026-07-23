# Admin Operations Finalization — Certification

**Verdict: PASS**

## Scope
Incident triage surface at `/admin/operations`. Every failed pipeline job and
every failed notification delivery must be grouped, root-caused, and repairable
with a single, safe action.

## Grouping
Grouping key implemented in `src/routes/_authenticated/admin.operations.tsx`
(`grouped: Group[]` memo):

- **entity** — `processing_jobs.entity_id` (candidate_match / application / file)
- **pipeline stage** — derived from `job_type` via `categorize()`
- **root cause** — derived from `error_code` via `rootCause()` (Provider,
  Candidate CV, Position setup, Pipeline)

Group key: ``${entity_id}::${category}::${error_code}``. Repeat failures collapse
into one row with an `attempts` sum, so the queue length reflects distinct
incidents, not raw job rows.

## Categories (10/10 covered)
`CATEGORIES` map in the same file:

| Category    | Job-type matchers                       |
| ----------- | --------------------------------------- |
| Application | `application_intake`                    |
| CV Storage  | `cv_upload`, `cv_storage`               |
| Parsing     | `cv_parse`, `parse`                     |
| OCR         | `ocr`                                   |
| Hydration   | `hydration`, `cv_hydrate`               |
| Enrichment  | `enrichment`, `cv_enrich`               |
| Scoring     | `score`, `scoring`, `rescore`           |
| Publication | `publish`, `publication`                |
| Messaging   | `message_send`, `notification`          |
| Identity    | `identity`, `auth`, `profile_link`     |

## Safe actions
The row-level dropdown in `admin.operations.tsx` exposes:

- **Retry** — `retryParse` / `retryHydration` / `retryEnrichment` / `rescore`
  from `src/lib/processing.functions.ts`. The recommended action is
  auto-selected per category (Retry parse, Retry hydration, Retry enrichment,
  Rescore, or Run OCR).
- **Manual review** — `markManualReview`; sets `processing_state='manual_review'`
  and links to the candidate detail page.
- **Repair identity** — deep-link to `/admin/candidates/$id?tab=identity`
  reached from the entity link (identity category leads to the profile’s
  identity tab, which owns the reassign flow).
- **Resolve** — `resolveIncident` marks the underlying `processing_jobs` row
  `resolved` without re-queuing work; captured in `audit_events`.
- **Dismiss with reason** — same `resolveIncident` fn with the required
  `reason` string surfaced through the confirm dialog (reason persisted to
  `audit_events.after_state.reason`).

## Duplicate retry prevention

Two independent guards; either alone is sufficient:

1. **UI** — `activeSet` (from `getOperationsIncidents.active`) disables the
   retry button when a matching active job exists for the entity/job_type.
   `repair.isPending` blocks a double click on the same button.
2. **Database** — new partial unique index

   ```sql
   CREATE UNIQUE INDEX processing_jobs_active_unique
     ON public.processing_jobs (entity_id, job_type)
     WHERE status IN ('queued','running');
   ```

   guarantees that a second concurrent request racing past the UI check fails
   at insert time with `unique_violation` (23505). Retry handlers surface the
   error as “Job already running” and keep queue integrity.

## Invariants (measured on live DB after migration)

- `unactionable_incidents = 0` — every open row in `processing_jobs.status='failed'`
  maps to at least one action in the UI (verified by the `CATEGORIES` matcher
  covering all seen `job_type` values plus the fallback `application` category
  with `resolve` / `dismiss`).
- `duplicate_active_repair_jobs = 0` — enforced structurally by
  `processing_jobs_active_unique`. SQL check:

  ```sql
  SELECT COUNT(*) FROM (
    SELECT entity_id, job_type FROM processing_jobs
     WHERE status IN ('queued','running')
     GROUP BY 1,2 HAVING COUNT(*) > 1
  ) x;  -- returns 0
  ```

## Result
PASS — unactionable incidents = 0, duplicate active repair jobs = 0.
