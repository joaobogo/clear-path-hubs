# Runbook 14 — Migration Issue

**Symptoms**
- Deployment fails on migration step.
- Post-deploy app errors reference newly changed schema.

**Diagnosis**
1. `supabase--linter` and `supabase--db_health`.
2. Check migration log — which statement failed?
3. `SELECT * FROM audit_events WHERE occurred_at > now() - interval '30 min' ORDER BY occurred_at DESC LIMIT 50;` to inspect side effects.

**Safe action**
- **Forward-fix only.** Never edit an applied migration. Write a compensating migration (`fix_<original>_YYYYMMDDHHMM.sql`) that:
  - Adds missing GRANTs.
  - Re-adds dropped policies.
  - Reverts a broken column change with an explicit `ALTER`.
- If the app is broken pre-deploy, roll back the app deployment (previous published build) while the DB stays forward; TanStack app is stateless.

**Expected result**
- Linter clean; app healthy on published URL.

**Escalation**
- Data corruption suspected → Level 4 + freeze writes via `setMaintenanceMode(true, reason)`.

**Rollback**
- App: redeploy previous build.
- DB: compensating migration only; never `pg_restore` without Level 4 approval.

**Audit**
- Migration history is the audit; note incident in `/admin/status` with `trace_id` if user-facing.
