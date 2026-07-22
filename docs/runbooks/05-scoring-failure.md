# Runbook 05 — Scoring Failure

**Symptoms**
- Candidate `processing_state='enriched'` but no `candidate_matches` row for open positions matched by tenant.
- OR `score_runs.status='failed'`.

**Diagnosis**
1. `SELECT * FROM score_runs WHERE candidate_profile_id=$1 ORDER BY created_at DESC LIMIT 5;`
2. Check `score_runs.failure_reason` and `provider_usage_events(operation='score')`.
3. Confirm position is `active` and requirements are non-empty.

**Safe action**
- Provider transient → `retryScore(candidateProfileId, positionId)` (max 2 retries).
- Requirements malformed → route to runbook 07 (publication blocker).
- Persistent failure → `disableScoringForPosition(positionId, reason)` — halts new scoring until requirements fixed.

**Expected result**
- `candidate_matches` row upserted with new `score_run_id`; match appears in `/admin/publish`.

**Escalation**
- Failure rate > 10% hourly → runbook 10.

**Rollback**
- `score_runs` is append-only + immutable (trigger `tg_score_runs_immutable`). Revert visible score by pointing `candidate_matches.score_run_id` at prior successful run via `revertMatchScore(matchId, previousRunId)`.

**Audit**
- `support_actions('other')`; all `score_runs` retained per policy.
