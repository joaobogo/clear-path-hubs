# Runbook 04 — Enrichment Failure

**Symptoms**
- `processing_state = 'failed'` with `processing_error LIKE '%enrich%'`, OR stuck in `enriching` for > 15 min.

**Diagnosis**
1. `processing_jobs` last row for the candidate; `attempts` count.
2. `provider_usage_events` for `enrichment` failures in last hour (provider outage?).
3. Rate cap: `SELECT * FROM cost_limits WHERE operation='enrichment'`.

**Safe action**
- Stuck > 15 min → the sweeper resets to `queued`. If it didn't, `resetProcessingJob(jobId)`.
- Persistent error → `skipEnrichment(candidateProfileId, reason)` — scoring proceeds on parse evidence only, evidence flagged as "unenriched".

**Expected result**
- Candidate advances to `enriched` or `scored`. `candidate_matches` populated.

**Escalation**
- > 20% enrichment failures in a rolling hour → runbook 10 (provider outage).

**Rollback**
- Enrichment writes are additive to `candidate_evidence` (source='enrichment'); revert by `DELETE FROM candidate_evidence WHERE candidate_profile_id=$1 AND source='enrichment'` **via canonical writer only**.

**Audit**
- All actions in `support_actions`; `provider_usage_events` retained 180 d.
