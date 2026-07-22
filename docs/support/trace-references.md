# Trace ID and Error References

## User-facing errors

Every user-facing failure surface returns a **reference ID** of the form `err_<8 base32>` (e.g. `err_K3P9WQXA`). Rendered as: *"Something went wrong. Reference: err_K3P9WQXA — please share this with support."*

## Server pipeline

1. Server function throws or returns failure.
2. `errorMiddleware` in `src/start.ts` catches, mints `err_XXX`, generates internal `trace_id` (`trc_<ULID>`), and inserts a row into `trace_index`:
   - `reference_id` = `err_XXX` (PK, unique)
   - `trace_id` = `trc_XXX`
   - `actor_user_id`, `organization_id`, `action` (server fn name), `request_summary` (redacted body — no CV bytes, no email, no phone), `result='failure'`, `failure_reason`, `http_status`, `occurred_at`.
3. UI renders `reference_id` in a shadcn `<ErrorState referenceId={...} />`.
4. All server logs include `{ traceId, referenceId, userId, orgId, action }` — searchable in `stack_modern--server-function-logs`.

## Support lookup

Route: `/admin/support/trace/$referenceId` (to build). Server fn `lookupTrace`:
- Requires `is_platform_staff`.
- Reads `trace_index` row by `reference_id`.
- Joins recent (`occurred_at ± 15 min`) `audit_events`, `processing_jobs`, and `support_actions` on `trace_id` to reconstruct:
  - request (action name + redacted summary)
  - user (actor_user_id, profile.name, email)
  - tenant (organization_id + name)
  - backend result (failure_reason, http_status, plus audit before/after states of affected rows)
  - retries + downstream jobs
- Returns a single JSON tree the support UI renders as a timeline.

## Retention

- `trace_index`: 180 days (`retention_policies.data_class='trace_index'`).
- `support_actions`: 7 years (audit).
- `audit_events`: existing policy.
