# Runbook 01 — Failed Intake

**Symptoms**
- User reports `err_XXX` on the final step of `/intake`.
- `submitIntake` returns non-2xx; no `organizations`/`positions` row appears for the reported email.

**Diagnosis**
1. `/admin/support/trace/$referenceId` → look up the `trace_id`.
2. Query `trace_index` for `failure_reason` and `http_status`.
3. Inspect `audit_events` window (± 5 min) — was any partial state written?
4. Check `processing_jobs` for `job_type='intake_activation'`.

Common causes:
- Duplicate email collision (`profiles.email` unique) → user already has an account with a different flow.
- LLM parse of the "Requirements" step failed → validation succeeded but downstream summary failed.
- Cloud restart mid-request.

**Safe action**
- **Duplicate email**: `resendInvitation` (see runbook 13). Do NOT create a second profile.
- **LLM failure**: rerun `retryIntake(traceId)` — idempotent by hash.
- **Partial write**: run `rollbackIntake(traceId)` (canonical; wraps deletes of orphan `organizations` + `positions` created within the same trace).

**Expected result**
- Either the position is now `draft` and appears in `/admin/intakes`, or the intake is cleanly rolled back and the user can resubmit.

**Escalation**
- If `rollbackIntake` refuses (rows referenced elsewhere) → Level 3 engineering.

**Rollback**
- `rollbackIntake` is itself the rollback path; it is safe to rerun.

**Audit**
- Every action logs `support_actions('other', target=organizations|positions)`; the `trace_id` chain is preserved.
