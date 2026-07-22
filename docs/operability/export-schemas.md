# Export Schemas

Every export goes through a canonical `exports.request(type, filters)` server function that:
1. Verifies the caller may read every field being exported (via `requireSupabaseAuth` + role check).
2. Applies the same filter payload the visible list uses — no separate query builder.
3. Stamps `data_freshness_at = now()` and `filters` on the `export_jobs` row.
4. Streams rows to a temporary file uploaded to the `cvs` bucket under `exports/`.
5. Writes an `audit_events` row with `entity_type='export_jobs'`, `entity_id=<job>`, `action='EXPORT'`.
6. Returns a signed URL, 7-day expiry, single download.

## Admin exports

| Type | Fields | Excluded by permission |
|---|---|---|
| `admin_position_pipeline` | position_id, title, client, stage, count, oldest_in_stage, owner, updated_at | — |
| `admin_candidate_list` | candidate_id, full_name, email, phone, headline, location, latest_application, latest_stage, latest_score | compensation_preferences, work_authorization when caller lacks `operations`/`platform_admin` role |
| `admin_processing_failures` | job_id, entity_id, error, retries, first_failed_at, last_failed_at | — |
| `admin_audit_activity` | event_id, actor, entity_type, entity_id, action, at, trace_id | before_state / after_state redacted for non-`platform_admin` |

## Client exports

| Type | Fields | Excluded |
|---|---|---|
| `client_candidate_shortlist` | anonymized ref, headline, score band, key evidence bullets, availability, location | full_name, email, phone until match stage advanced past `shortlisted`; compensation always excluded unless stage past `offer` |
| `client_position_summary` | title, requirements, screening questions, funnel counts, current stage distribution | internal admin notes |
| `client_candidate_one_pager` | published fields only for one candidate | admin notes, other clients' feedback, other positions |

## Enforced constraints

- The CSV/PDF writer is a single module (`src/lib/exports.server.ts`) with a per-type column map. Adding a field requires updating the map — never `SELECT *`.
- Every export row output includes header footer: `Generated {ISO} · Filters: {json} · Freshness: {ISO} · Job {id}`.
- Failed exports mark `status='failed'` with `error`; a failed job never leaves a partial file.
- Exports expire per bucket lifecycle (7 days). Retention row seeded (`export_jobs` = 90 days).
