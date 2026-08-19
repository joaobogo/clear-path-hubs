# Plan - MVP Readiness Fixes

Assessed the current state at 76%. The following plan resolves the primary blockers identified in the release gate.

## Candidate E2E Stability
- Fix `tests/e2e/smoke-journey.spec.ts` Step 1 by correctly selecting the "Create a candidate account" checkbox before filling the password.
- Verify the full journey from apply to admin approval to client visibility.

## Security & Scoping
- Audit the 9 remaining `security_definer` views in Supabase; convert all non-privileged views to `security_invoker`.
- Re-run the security scan to verify 0 error-level findings.

## Dashboard & Metric Stability
- Fix regressed seat-reactivation logic in `seat-reactivation.spec.ts` and `seat-reactivation-actions.spec.ts`.
- Resolve the scoring idempotency and corrupt-CV recovery failures in `pipeline.spec.ts`.
- Fix the remaining 3 unit test failures (CSV masking, blueprint progress, and messaging timeout).

## Technical Details
- Update `tests/e2e/smoke-journey.spec.ts`:
  ```typescript
  await page.getByLabel(/create a candidate account/i).check();
  ```
- Migration to convert views:
  ```sql
  ALTER VIEW client_dashboard_kpis SET (security_invoker = on);
  ALTER VIEW admin_work_inbox SET (security_invoker = on);
  ```
