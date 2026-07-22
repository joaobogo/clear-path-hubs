# Runbook 10 — Provider Outage (LLM / Email / Storage)

**Symptoms**
- Spike in `provider_usage_events(success=false)`.
- Multiple runbooks (02, 04, 05, 11) firing simultaneously.

**Diagnosis**
1. `/admin/operations` — check hourly failure rate vs 7d median.
2. Provider status page (Lovable AI Gateway, Resend, Supabase).
3. `stack_modern--server-function-logs` filtered by `provider=` + `error_code`.

**Safe action**
- Set the affected pipeline into **degraded mode** via `setProviderCircuitBreaker(provider, 'open', reason)`:
  - LLM open → jobs stay `queued`; UI shows banner "Scoring temporarily paused"; no retries burn budget.
  - Email open → notifications continue in-app; queue emails for later flush.
  - Storage open → block new uploads, existing downloads pass through.
- Post an incident to `/admin/status` and notify affected tenants.

**Expected result**
- Failure spike stops; queued jobs resume once breaker closes (auto after 5 clean minutes, or manual `close`).

**Escalation**
- > 30 min outage → Level 4 + external comms.

**Rollback**
- Circuit breaker is itself the rollback; `close` returns to normal operation.

**Audit**
- Breaker open/close events logged in `audit_events`; every skipped job retains its state for replay.
