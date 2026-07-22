# Runbook 09 — Duplicate Candidate

**Symptoms**
- Two `candidate_profiles` rows for the same person (email variant, phone match, or same CV hash).

**Diagnosis**
1. `SELECT * FROM candidate_profiles WHERE lower(email) = lower($email);`
2. `SELECT id, sha256 FROM files WHERE candidate_profile_id IN (...);`
3. Compare `candidate_evidence.identity` for name/phone match.

**Safe action**
- `mergeCandidateProfiles(keepId, dropId, reason)` — canonical:
  - Moves `applications`, `candidate_matches`, `messages`, `consent_records`, `candidate_evidence` from `dropId` to `keepId`.
  - Preserves oldest `created_at`.
  - Marks `dropId` as `merged_into=keepId`, `status='merged'` (soft delete).
  - Emits `notification_events('candidate.merged')` to the candidate.

**Expected result**
- Single candidate profile with unified history; the dropped ID resolves to the kept profile in searches.

**Escalation**
- Conflicting consent state (one revoked, one active) → do NOT merge automatically; escalate to Product Ops to reconcile.

**Rollback**
- `unmergeCandidateProfiles(mergeOperationId)` within 24 h — replays inverse moves from the merge audit row.

**Audit**
- Full merge diff in `audit_events`; downstream `candidate_matches` retain their `score_run_id` history.
